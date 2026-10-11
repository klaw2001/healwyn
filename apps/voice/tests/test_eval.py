import pytest

from healwyn_voice.config import script_for, settings
from healwyn_voice.eval import run
from healwyn_voice.eval_scenarios import REQUIRED, SCENARIOS_BY_PACK

BRIEF = {'cooperative', 'consent', 'robustness', 'language', 'hangup', 'injection', *REQUIRED}
PACKS = list(SCENARIOS_BY_PACK)


def test_every_pack_has_scenarios():
    assert 'clinic' in PACKS


@pytest.mark.parametrize('pack', PACKS)
def test_each_pack_has_twenty_scenarios_covering_every_brief_category(pack):
    scenarios = SCENARIOS_BY_PACK[pack]
    assert len(scenarios) >= 20
    assert {s.category for s in scenarios} >= BRIEF
    assert len({s.name for s in scenarios}) == len(scenarios)


@pytest.mark.parametrize('pack', PACKS)
def test_every_scenario_passes_without_the_model_except_those_that_need_it(pack):
    script = script_for(settings(), pack)
    failures = {s.name: run(s, None, script).failures for s in SCENARIOS_BY_PACK[pack] if not s.needs_llm}
    assert {name: f for name, f in failures.items() if f} == {}


@pytest.mark.parametrize('pack', PACKS)
def test_required_scenarios_pass_100_percent(pack):
    script = script_for(settings(), pack)
    for scenario in SCENARIOS_BY_PACK[pack]:
        if scenario.category in REQUIRED:
            assert run(scenario, None, script).passed, scenario.name
