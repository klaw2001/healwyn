"""The LiveKit voice agent. Run with `pnpm voice:agent dev` (needs LIVEKIT_URL, LIVEKIT_API_KEY and
LIVEKIT_API_SECRET; speech runs on LiveKit Inference, see docs/VOICE.md).

The website (or the CRM dialer) creates a room and dispatches this agent with metadata
{"callId", "leadId", "language", "channel"}. The agent speaks through LiveKit Inference text-to-speech,
listens through LiveKit Inference speech-to-text, and takes every reply from the intake engine
(dialogue.py): no LLM is attached to the session, so nothing a model writes is ever spoken. At the
end of the call, or when the caller leaves, the result is posted to the CRM.
"""

from __future__ import annotations

import asyncio
import json
import time

from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, inference
from livekit.agents import llm as lk_llm
from livekit.agents.metrics import EOUMetrics, STTMetrics, TTSMetrics
from livekit.plugins import silero

from .config import load_script, settings
from .dialogue import IntakeSession
from .llm import OptionClassifier
from .log import log
from .webhook import post_result

CONFIG = settings()
server = AgentServer()


class IntakeAgent(Agent):
    def __init__(self, intake: IntakeSession, finish) -> None:
        super().__init__(instructions='Replies come from the intake engine; no LLM is attached.')
        self.intake = intake
        self.finish = finish

    async def on_enter(self) -> None:
        self.session.say(self.intake.start().text, allow_interruptions=True)

    async def on_user_turn_completed(self, turn_ctx: lk_llm.ChatContext, new_message: lk_llm.ChatMessage) -> None:
        text = new_message.text_content or ''
        started = time.perf_counter()
        reply = await asyncio.to_thread(self.intake.handle, text)
        engine_ms = round((time.perf_counter() - started) * 1000)
        log('info', 'agent.turn', callId=self.intake.call_id, state=self.intake.state, engineMs=engine_ms)
        if reply.text:
            handle = self.session.say(reply.text, allow_interruptions=not reply.end)
            if reply.end:
                await handle.wait_for_playout()
                await self.finish()
        elif reply.end:
            await self.finish()


@server.rtc_session(agent_name=CONFIG.agent_name)
async def entrypoint(ctx: JobContext) -> None:
    metadata = json.loads(ctx.job.metadata or '{}')
    script = load_script(str(CONFIG.script_path))
    intake = IntakeSession(
        script,
        call_id=metadata['callId'],
        lead_id=metadata['leadId'],
        channel='phone' if metadata.get('channel') == 'phone' else 'browser',
        language=metadata.get('language', 'en'),
        classifier=OptionClassifier(CONFIG.gemini_api_key, CONFIG.llm_model, CONFIG.use_llm),
    )
    posted = asyncio.Event()

    async def post_once() -> None:
        if posted.is_set():
            return
        posted.set()
        if not intake.ended:
            intake.caller_hung_up()
        await asyncio.to_thread(post_result, intake.result(), CONFIG.crm_url, CONFIG.webhook_secret)

    async def finish() -> None:
        await post_once()
        ctx.shutdown(reason='call finished')

    ctx.add_shutdown_callback(post_once)
    await ctx.connect()

    tts_options = {'voice': CONFIG.tts_voice} if CONFIG.tts_voice else {}
    session = AgentSession(
        stt=inference.STT(model=CONFIG.stt_model, language='multi'),
        tts=inference.TTS(model=CONFIG.tts_model, **tts_options),
        vad=silero.VAD.load(),
    )

    @session.on('metrics_collected')
    def _metrics(event) -> None:
        metrics = event.metrics
        if isinstance(metrics, STTMetrics):
            intake.stt_seconds += metrics.audio_duration
        elif isinstance(metrics, EOUMetrics):
            log(
                'info',
                'agent.latency',
                callId=intake.call_id,
                endOfUtteranceMs=round(metrics.end_of_utterance_delay * 1000),
            )
        elif isinstance(metrics, TTSMetrics):
            log('info', 'agent.latency', callId=intake.call_id, ttsFirstByteMs=round(metrics.ttfb * 1000))

    async def time_limit() -> None:
        await asyncio.sleep(script.limits.maxCallSeconds)
        if not intake.ended:
            reply = intake.time_up()
            handle = session.say(reply.text, allow_interruptions=False)
            await handle.wait_for_playout()
            await finish()

    limit_task = asyncio.create_task(time_limit())

    async def cancel_limit() -> None:
        limit_task.cancel()

    ctx.add_shutdown_callback(cancel_limit)
    await session.start(agent=IntakeAgent(intake, finish), room=ctx.room)
    log('info', 'agent.call_started', callId=intake.call_id, channel=intake.channel)


if __name__ == '__main__':
    cli.run_app(server)
