from healwyn_voice.eval import run
from healwyn_voice.eval_scenarios import REQUIRED, SCENARIOS


def test_there_are_at_least_twenty_scenarios_covering_every_brief_category():
    assert len(SCENARIOS) >= 20
    categories = {s.category for s in SCENARIOS}
    assert {'cooperative', 'consent', 'robustness', 'language', 'hangup', 'injection', *REQUIRED} <= categories


def test_every_scenario_passes_without_the_model_except_those_that_need_it():
    failures = {s.name: run(s, None).failures for s in SCENARIOS}
    unexpected = {
        name: f for name, f in failures.items() if f and not next(s for s in SCENARIOS if s.name == name).needs_llm
    }
    assert unexpected == {}


def test_required_scenarios_pass_100_percent():
    for scenario in SCENARIOS:
        if scenario.category in REQUIRED:
            assert run(scenario, None).passed, scenario.name
