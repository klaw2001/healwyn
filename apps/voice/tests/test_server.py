import json
import threading
import urllib.error
import urllib.request
import uuid
from dataclasses import replace
from http.server import ThreadingHTTPServer

import pytest

from healwyn_voice.config import REPO_ROOT, Settings
from healwyn_voice.server import Service, make_handler
from healwyn_voice.webhook import sign

SECRET = 'a' * 40
LEAD = '1ead0000-0000-4000-8000-000000000001'


@pytest.fixture
def service():
    config = Settings(
        pack='clinic',
        script_path=REPO_ROOT / 'packages/core/contracts/voice-script.clinic.json',
        crm_url='http://crm.invalid',
        webhook_secret='w' * 40,
        agent_secret=SECRET,
        gemini_api_key='',
        llm_model='none',
        use_llm=False,
        text_host='127.0.0.1',
        text_port=0,
        stt_model='',
        tts_model='',
        tts_voice='',
        agent_name='test',
    )
    posted = []
    svc = Service(config, post=lambda result, url, secret: posted.append(result) or 200)
    svc.posted = posted
    return svc


@pytest.fixture
def base_url(service):
    httpd = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(service))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()


def call(base_url, path, body, secret=SECRET, timestamp=None):
    data = json.dumps(body).encode()
    headers = {'content-type': 'application/json', **(sign(data, secret, timestamp) if secret else {})}
    request = urllib.request.Request(base_url + path, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def test_rejects_unsigned_forged_and_stale_requests(base_url):
    body = {'callId': str(uuid.uuid4()), 'leadId': LEAD, 'channel': 'text'}
    assert call(base_url, '/sessions', body, secret=None) == (401, {'error': 'missing_signature'})
    assert call(base_url, '/sessions', body, secret='b' * 40) == (401, {'error': 'bad_signature'})
    assert call(base_url, '/sessions', body, timestamp=1_000) == (401, {'error': 'stale'})


def test_a_typed_chat_from_greeting_to_result(base_url, service):
    call_id = str(uuid.uuid4())
    status, body = call(base_url, '/sessions', {'callId': call_id, 'leadId': LEAD, 'channel': 'text'})
    assert status == 200 and 'AI assistant' in body['reply']
    for text in ['yes', 'teeth', 'nothing', 'evening', 'first', 'no', 'yes']:
        status, body = call(base_url, f'/sessions/{call_id}/turns', {'text': text})
        assert status == 200
    assert body['ended'] and body['posted'] == 200
    [result] = service.posted
    assert str(result.callId) == call_id and result.outcome == 'completed' and result.channel == 'text'
    # The session is gone once posted.
    assert call(base_url, f'/sessions/{call_id}/turns', {'text': 'hello'})[0] == 404


def test_ending_a_chat_early_posts_what_was_collected(base_url, service):
    call_id = str(uuid.uuid4())
    call(base_url, '/sessions', {'callId': call_id, 'leadId': LEAD, 'channel': 'text'})
    call(base_url, f'/sessions/{call_id}/turns', {'text': 'yes'})
    call(base_url, f'/sessions/{call_id}/turns', {'text': 'skin'})
    assert call(base_url, f'/sessions/{call_id}/end', {})[1] == {'ended': True, 'posted': 200}
    assert service.posted[-1].outcome == 'caller_ended'


def test_simulated_dialer_runs_a_whole_call(base_url, service):
    call_id = str(uuid.uuid4())
    status, body = call(
        base_url,
        '/simulate',
        {
            'callId': call_id,
            'leadId': LEAD,
            'language': 'hi',
            'turns': ['हाँ', 'दाँत', 'कुछ नहीं', 'शाम', 'पहली बार', 'नहीं', 'हाँ'],
        },
    )
    assert status == 200 and body['outcome'] == 'completed'
    assert service.posted[-1].language == 'hi'


def test_validates_requests(base_url, service):
    assert call(base_url, '/sessions', {'callId': 'nope', 'leadId': LEAD, 'channel': 'text'})[0] == 400
    assert call(base_url, '/sessions', {'callId': str(uuid.uuid4()), 'leadId': LEAD, 'channel': 'phone'})[0] == 400
    assert call(base_url, f'/sessions/{uuid.uuid4()}/turns', {'text': 'hi'})[0] == 404


def test_expired_sessions_are_finished_and_posted(service):
    service.start({'callId': str(uuid.uuid4()), 'leadId': LEAD, 'channel': 'text'})
    [(session, _lock)] = service.sessions.values()
    session._clock = lambda: 1e9
    service.sweep()
    assert not service.sessions
    assert service.posted[-1].outcome == 'limit_reached'


def test_refuses_to_start_with_real_data(monkeypatch):
    from healwyn_voice import config

    monkeypatch.setenv('VOICE_REAL_DATA', 'true')
    with pytest.raises(config.RealDataRefused):
        config.settings()


def test_settings_replace_is_usable(service):
    assert replace(service.config, use_llm=True).use_llm
