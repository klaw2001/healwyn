"""Deterministic safety checks. They run on every caller turn, before anything else, in every language
(callers switch between English and Hindi mid-sentence), and no model can override them.

* Red flags (emergency symptoms) stop the intake: the caller is told to call the emergency number.
  A red flag is ignored only when a negation sits right before it ("no chest pain") or, in Hindi,
  right after it ("सीने में दर्द नहीं"). When in doubt it fires: a false alarm costs one sentence.
* Requests for medical advice are declined kindly, and the intake continues.
* Attempts to change the assistant's rules or extract its instructions are refused.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .contracts import VoiceScript
from .text import Match, find_phrases, tokens


def _all(lists: dict[str, list[str]]) -> list[str]:
    return [phrase for phrases in lists.values() for phrase in phrases]


@dataclass
class SafetyResult:
    red_flag: str | None = None
    advice_request: bool = False
    injection: bool = False
    identity_question: bool = False
    high_urgency: bool = False
    matched: list[str] = field(default_factory=list)


class SafetyChecker:
    def __init__(self, script: VoiceScript) -> None:
        safety = script.safety
        self._flags = [(flag.id, _all(flag.phrases)) for flag in safety.redFlags]
        self._negations = set(_all(safety.negations))
        # Hindi puts the negation after the phrase ("सीने में दर्द नहीं", "seene mein dard nahi").
        self._negations_after = set(safety.negations.get('hi', []))
        self._advice = _all(safety.adviceRequests)
        self._cues = _all(safety.adviceCues)
        self._topics = _all(safety.adviceTopics)
        self._injection = _all(safety.injection)
        self._identity = _all(script.identity.phrases)
        self._urgency = _all(safety.highUrgency)

    def _negated(self, words: list[str], match: Match) -> bool:
        before = words[max(0, match.start - 3) : match.start]
        if any(' '.join(before[i:]) in self._negations for i in range(len(before))):
            return True
        if any(w in self._negations for w in before[-2:]):
            return True
        after = words[match.start + match.length : match.start + match.length + 2]
        return any(w in self._negations_after for w in after)

    def red_flag(self, text: str) -> str | None:
        words = tokens(text)
        for flag_id, phrases in self._flags:
            for match in find_phrases(text, phrases):
                if not self._negated(words, match):
                    return flag_id
        return None

    def check(self, text: str) -> SafetyResult:
        result = SafetyResult()
        result.red_flag = self.red_flag(text)
        result.advice_request = bool(find_phrases(text, self._advice)) or (
            bool(find_phrases(text, self._cues)) and bool(find_phrases(text, self._topics))
        )
        result.injection = bool(find_phrases(text, self._injection))
        result.identity_question = bool(find_phrases(text, self._identity))
        result.high_urgency = bool(find_phrases(text, self._urgency))
        return result
