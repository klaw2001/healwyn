from healwyn_voice.webhook import sign, sign_request, verify_request

SECRET = 'x' * 32


def test_signature_matches_the_typescript_implementation():
    # Computed with node: createHmac('sha256', 'x'.repeat(32)).update('1700000000.{"a":1}').digest('hex')
    headers = sign(b'{"a":1}', SECRET, 1700000000)
    assert headers == {
        'x-webhook-timestamp': '1700000000',
        'x-webhook-signature': 'sha256=957b87db4c7d287b0d2756d5f57bcf571479322e7049a798062a09e371afead2',
    }


def test_service_signature_matches_the_typescript_implementation():
    # node: createHmac('sha256', 'x'.repeat(32)).update('1700000000.POST /sessions.{"a":1}').digest('hex')
    # (packages/messaging/src/service-signature.ts)
    headers = sign_request('POST', '/sessions', b'{"a":1}', SECRET, 1700000000)
    assert headers['x-webhook-signature'] == ('sha256=124bacd5fd60bdd8f696b935c46c1694cfc4d97fd15de069d66ecd003ff24802')


def test_verify_accepts_fresh_valid_requests_for_the_signed_endpoint_only():
    body = b'{"callId":"x"}'
    path = '/sessions/0f0e0d0c-0000-4000-8000-000000000001/end'
    headers = sign_request('POST', path, body, SECRET, 1_000_000)
    assert verify_request('POST', path, body, headers, SECRET, now=1_000_100) is None
    assert verify_request('POST', path, body, headers, SECRET, now=1_000_301) == 'stale'
    assert verify_request('POST', path, b'{"callId":"y"}', headers, SECRET, now=1_000_100) == 'bad_signature'
    other = '/sessions/0f0e0d0c-0000-4000-8000-000000000002/end'
    assert verify_request('POST', other, body, headers, SECRET, now=1_000_100) == 'bad_signature'
    assert verify_request('POST', '/simulate', body, headers, SECRET, now=1_000_100) == 'bad_signature'
    assert verify_request('POST', path, body, {}, SECRET) == 'missing_signature'
    assert verify_request('POST', path, body, headers, 'short') == 'not_configured'


def test_verify_rejects_malformed_headers_without_raising():
    body = b'{}'
    good = sign_request('POST', '/sessions', body, SECRET, 1_000_000)
    for headers in (
        {**good, 'x-webhook-timestamp': '\u00b2'},  # a Unicode digit
        {**good, 'x-webhook-timestamp': '-5'},
        {**good, 'x-webhook-timestamp': '1' * 11},
        {**good, 'x-webhook-signature': 'sha256=\u00e9' * 2},  # non-ASCII
        {**good, 'x-webhook-signature': good['x-webhook-signature'].upper()},
    ):
        assert verify_request('POST', '/sessions', body, headers, SECRET, now=1_000_000) == 'bad_signature'
