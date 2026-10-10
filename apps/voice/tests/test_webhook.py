from healwyn_voice.webhook import sign, verify

SECRET = 'x' * 32


def test_signature_matches_the_typescript_implementation():
    # Computed with node: createHmac('sha256', 'x'.repeat(32)).update('1700000000.{"a":1}').digest('hex')
    headers = sign(b'{"a":1}', SECRET, 1700000000)
    assert headers == {
        'x-webhook-timestamp': '1700000000',
        'x-webhook-signature': 'sha256=957b87db4c7d287b0d2756d5f57bcf571479322e7049a798062a09e371afead2',
    }


def test_verify_accepts_fresh_valid_requests_only():
    body = b'{"callId":"x"}'
    headers = sign(body, SECRET, 1_000_000)
    assert verify(body, headers, SECRET, now=1_000_100) is None
    assert verify(body, headers, SECRET, now=1_000_301) == 'stale'
    assert verify(b'{"callId":"y"}', headers, SECRET, now=1_000_100) == 'bad_signature'
    assert verify(body, {}, SECRET) == 'missing_signature'
    assert verify(body, headers, 'short') == 'not_configured'
