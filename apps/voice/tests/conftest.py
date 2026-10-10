import pytest

from healwyn_voice.config import default_script
from healwyn_voice.dialogue import IntakeSession

LEAD = '1ead0000-0000-4000-8000-000000000001'


@pytest.fixture(scope='session')
def script():
    return default_script()


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def new_session(script, clock):
    def make(language: str = 'en', classifier=None) -> IntakeSession:
        return IntakeSession(
            script, lead_id=LEAD, channel='text', language=language, classifier=classifier, clock=clock
        )

    return make
