"""The text service: the same intake conversation over HTTP, for the website's typed chat (when the
microphone is unavailable) and the CRM's simulated dialer. Run with `pnpm voice:serve`.

Every request is signed with VOICE_AGENT_SECRET (see webhook.py). Finished calls are posted to the
CRM's /api/voice/complete, exactly as the LiveKit agent posts them.

POST /sessions                 {callId, leadId, channel: "text"|"simulated", language}  -> {reply, ended}
POST /sessions/<callId>/turns  {text}                                                    -> {reply, ended}
POST /sessions/<callId>/end    {}                                                        -> {ended}
POST /simulate                 {callId, leadId, language, turns: [..]}                   -> {transcript, outcome}
GET  /health
"""

from __future__ import annotations

import json
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from . import VERSION
from .config import Settings, load_script, settings
from .dialogue import IntakeSession
from .llm import OptionClassifier
from .log import log
from .webhook import post_result, verify

MAX_BODY = 16 * 1024
MAX_SESSIONS = 25
SESSION_PATH = re.compile(r'^/sessions/([0-9a-f-]{36})/(turns|end)$')


def _uuid(value: Any) -> str:
    return str(uuid.UUID(str(value)))


class Service:
    def __init__(self, config: Settings, post=post_result) -> None:
        self.config = config
        self.script = load_script(str(config.script_path))
        self.sessions: dict[str, tuple[IntakeSession, threading.Lock]] = {}
        self.lock = threading.Lock()
        self.post = post

    def classifier(self) -> OptionClassifier:
        return OptionClassifier(self.config.gemini_api_key, self.config.llm_model, self.config.use_llm)

    def finish(self, session: IntakeSession) -> int:
        with self.lock:
            self.sessions.pop(session.call_id, None)
        return self.post(session.result(), self.config.crm_url, self.config.webhook_secret)

    def start(self, body: dict) -> dict:
        channel = body.get('channel')
        if channel not in {'text', 'simulated'}:
            raise ValueError('channel')
        call_id, lead_id = _uuid(body['callId']), _uuid(body['leadId'])
        with self.lock:
            if call_id in self.sessions:
                raise ValueError('duplicate')
            if len(self.sessions) >= MAX_SESSIONS:
                raise OverflowError('busy')
            session = IntakeSession(
                self.script,
                call_id=call_id,
                lead_id=lead_id,
                channel=channel,
                language=str(body.get('language', 'en')),
                classifier=self.classifier(),
            )
            self.sessions[call_id] = (session, threading.Lock())
        log('info', 'text.session_started', callId=call_id, channel=channel)
        return {'reply': session.start().text, 'ended': False, 'language': session.lang}

    def turn(self, call_id: str, body: dict) -> dict:
        entry = self.sessions.get(call_id)
        if entry is None:
            raise KeyError(call_id)
        session, lock = entry
        text = str(body.get('text', ''))[:1000]
        with lock:
            started = time.perf_counter()
            reply = session.handle(text)
            took_ms = round((time.perf_counter() - started) * 1000)
        log('info', 'text.turn', callId=call_id, state=session.state, ms=took_ms)
        response = {'reply': reply.text, 'ended': reply.end, 'language': session.lang}
        if reply.end:
            response['posted'] = self.finish(session)
        return response

    def end(self, call_id: str) -> dict:
        entry = self.sessions.get(call_id)
        if entry is None:
            raise KeyError(call_id)
        session, lock = entry
        with lock:
            session.caller_hung_up()
        return {'ended': True, 'posted': self.finish(session)}

    def simulate(self, body: dict) -> dict:
        """A whole call from a list of caller turns: the simulated dialer."""
        call_id, lead_id = _uuid(body['callId']), _uuid(body['leadId'])
        turns = [str(t)[:1000] for t in body.get('turns', [])][:40]
        session = IntakeSession(
            self.script,
            call_id=call_id,
            lead_id=lead_id,
            channel='simulated',
            language=str(body.get('language', 'en')),
            classifier=self.classifier(),
        )
        session.start()
        for text in turns:
            if session.handle(text).end:
                break
        if not session.ended:
            session.caller_hung_up()
        posted = self.post(session.result(), self.config.crm_url, self.config.webhook_secret)
        log('info', 'text.simulated', callId=call_id, outcome=session.outcome, turns=len(turns), posted=posted)
        return {'outcome': session.outcome, 'posted': posted, 'transcript': session.transcript}

    def sweep(self, idle_after: float = 180) -> None:
        """Ends abandoned sessions so their results still reach the CRM: chats left idle end as the
        caller ending the call (timed to their last message); anything past the call limit times out."""
        limit = self.script.limits.maxCallSeconds + 60
        for call_id, (session, lock) in list(self.sessions.items()):
            with lock:
                if session.elapsed() > limit:
                    session.time_up()
                elif session.idle_seconds() > idle_after:
                    session.caller_hung_up(idle=True)
                else:
                    continue
            self.finish(session)
            log('info', 'text.session_expired', callId=call_id, outcome=session.outcome)


def make_handler(service: Service):
    class Handler(BaseHTTPRequestHandler):
        server_version = f'healwyn-voice/{VERSION}'

        def log_message(self, *_args) -> None:  # the default logs client addresses; ours log ids only
            return

        def _send(self, status: int, payload: dict) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('content-type', 'application/json; charset=utf-8')
            self.send_header('content-length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            if self.path == '/health':
                self._send(200, {'ok': True, 'version': VERSION, 'sessions': len(service.sessions)})
            else:
                self._send(404, {'error': 'not_found'})

        def do_POST(self) -> None:
            length = int(self.headers.get('content-length') or 0)
            if length > MAX_BODY:
                self._send(413, {'error': 'too_large'})
                return
            raw = self.rfile.read(length)
            headers = {k.lower(): v for k, v in self.headers.items()}
            problem = verify(raw, headers, service.config.agent_secret)
            if problem:
                self._send(503 if problem == 'not_configured' else 401, {'error': problem})
                return
            try:
                body = json.loads(raw or b'{}')
                if not isinstance(body, dict):
                    raise ValueError('body')
                if self.path == '/sessions':
                    self._send(200, service.start(body))
                elif self.path == '/simulate':
                    self._send(200, service.simulate(body))
                elif match := SESSION_PATH.match(self.path):
                    call_id, action = match.groups()
                    self._send(200, service.turn(call_id, body) if action == 'turns' else service.end(call_id))
                else:
                    self._send(404, {'error': 'not_found'})
            except KeyError:
                self._send(404, {'error': 'unknown_session'})
            except OverflowError:
                self._send(503, {'error': 'busy'})
            except (ValueError, TypeError):
                self._send(400, {'error': 'invalid_request'})

    return Handler


def serve() -> None:
    config = settings()
    service = Service(config)
    print(
        f'{service.script.brand} voice text service. Synthetic data only: the free Gemini tier may use inputs to '
        "improve Google's products.",
        flush=True,
    )

    def sweeper() -> None:
        while True:
            time.sleep(15)
            service.sweep()

    threading.Thread(target=sweeper, daemon=True).start()
    httpd = ThreadingHTTPServer((config.text_host, config.text_port), make_handler(service))
    log('info', 'text.listening', host=config.text_host, port=config.text_port, llm=service.classifier().enabled)
    httpd.serve_forever()


if __name__ == '__main__':
    serve()
