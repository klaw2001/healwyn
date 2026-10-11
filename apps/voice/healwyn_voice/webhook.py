"""Posting a finished call to the CRM, and verifying signed requests to the text service.

Calls to the CRM use the scheme of apps/crm/lib/server/webhooks.ts:
`x-webhook-signature: sha256=<hex HMAC-SHA256 of "{timestamp}.{body}">` with
`x-webhook-timestamp` in Unix seconds, accepted for five minutes.

Requests to the text service also sign the method and path ("{timestamp}.{METHOD} {path}.{body}",
packages/messaging/src/service-signature.ts), so a captured request cannot be replayed to another
endpoint or another call.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time
import urllib.error
import urllib.request

from .contracts import VoiceCallResult
from .log import log

REPLAY_WINDOW_SECONDS = 300
TIMESTAMP = re.compile(r'[0-9]{1,10}')
SIGNATURE = re.compile(r'sha256=[0-9a-f]{64}')


def sign(body: bytes, secret: str, timestamp: int | None = None) -> dict[str, str]:
    ts = str(int(time.time()) if timestamp is None else timestamp)
    digest = hmac.new(secret.encode(), ts.encode() + b'.' + body, hashlib.sha256).hexdigest()
    return {'x-webhook-timestamp': ts, 'x-webhook-signature': f'sha256={digest}'}


def sign_request(method: str, path: str, body: bytes, secret: str, timestamp: int | None = None) -> dict[str, str]:
    ts = str(int(time.time()) if timestamp is None else timestamp)
    message = f'{ts}.{method.upper()} {path}.'.encode() + body
    digest = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return {'x-webhook-timestamp': ts, 'x-webhook-signature': f'sha256={digest}'}


def verify_request(
    method: str, path: str, body: bytes, headers: dict[str, str], secret: str, now: int | None = None
) -> str | None:
    """None when valid, otherwise a reason code. Parses strictly: anything malformed is a bad signature."""
    if not secret or len(secret) < 32:
        return 'not_configured'
    ts = headers.get('x-webhook-timestamp', '')
    signature = headers.get('x-webhook-signature', '')
    if not ts or not signature:
        return 'missing_signature'
    if not TIMESTAMP.fullmatch(ts) or not SIGNATURE.fullmatch(signature):
        return 'bad_signature'
    current = int(time.time()) if now is None else now
    if abs(current - int(ts)) > REPLAY_WINDOW_SECONDS:
        return 'stale'
    expected = sign_request(method, path, body, secret, int(ts))['x-webhook-signature']
    return None if hmac.compare_digest(signature.encode(), expected.encode()) else 'bad_signature'


def post_result(result: VoiceCallResult, crm_url: str, secret: str, attempts: int = 3, sleep=time.sleep) -> int:
    """Posts the call to the CRM; retries network errors and 5xx with back-off.

    Returns the HTTP status, or 0 when the CRM was unreachable.
    """
    body = result.model_dump_json().encode()
    status = 0
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(
            f'{crm_url}/api/voice/complete',
            data=body,
            headers={'content-type': 'application/json', **sign(body, secret)},
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                status = response.status
        except urllib.error.HTTPError as error:
            status = error.code
        except (urllib.error.URLError, TimeoutError) as error:
            status = 0
            log('warn', 'voice.post_failed', callId=str(result.callId), attempt=attempt, error=type(error).__name__)
        if 200 <= status < 300 or 400 <= status < 500:
            break
        if attempt < attempts:
            sleep(2**attempt)
    log('info', 'voice.result_posted', callId=str(result.callId), status=status, outcome=str(result.outcome))
    return status
