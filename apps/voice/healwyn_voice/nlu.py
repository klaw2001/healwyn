"""Understanding answers without a model: option labels and synonyms in every language, yes/no,
skip and hang-up phrases. The model (llm.py) is only a fallback for answers this cannot place."""

from __future__ import annotations

from .contracts import VoiceQuestion, VoiceScript
from .text import find_phrases, looks_english, looks_hindi, normalize, tokens


def _all(lists: dict[str, list[str]]) -> list[str]:
    return [phrase for phrases in lists.values() for phrase in phrases]


class Understanding:
    def __init__(self, script: VoiceScript) -> None:
        self.script = script
        self._yes = _all(script.yes)
        self._no = _all(script.no)
        self._skip = _all(script.skip)
        self._hangup = _all(script.hangup)

    def yes_no(self, text: str) -> bool | None:
        """True for yes, False for no, None when unclear or both."""
        no = find_phrases(text, self._no)
        yes = find_phrases(text, self._yes)
        words = tokens(text)
        # "not right", "not okay", "isn't correct": a negated yes is a no.
        negated = [m for m in yes if m.start > 0 and words[m.start - 1] in {'not', "isn't", "wasn't", "that's not"}]
        if negated:
            no = [*no, *negated]
            yes = [m for m in yes if m not in negated]
        # "no problem", "not a problem" and "no worries" mean yes.
        if any(m.phrase in {'no', 'not'} for m in no) and find_phrases(
            text, ['no problem', 'not a problem', 'no worries']
        ):
            return True
        if yes and not no:
            return True
        if no and not yes:
            return False
        if yes and no:
            # The first clear word wins ("yes, no problem"; "no, not okay").
            return min(yes, key=lambda m: m.start).start < min(no, key=lambda m: m.start).start
        return None

    def wants_skip(self, text: str) -> bool:
        return bool(find_phrases(text, self._skip))

    def wants_hangup(self, text: str) -> bool:
        return bool(find_phrases(text, self._hangup))

    def option_for(self, question: VoiceQuestion, text: str) -> str | None:
        """The option whose label or synonym appears in text. The longest match wins; a tie between
        different options means the answer is ambiguous (None)."""
        if not question.options:
            return None
        best: dict[str, int] = {}
        for option in question.options:
            phrases = [*option.label.values(), *_all(option.synonyms), option.value.replace('-', ' ')]
            for match in find_phrases(text, phrases):
                best[option.value] = max(best.get(option.value, 0), len(normalize(match.phrase)))
        if not best and {o.value for o in question.options} == {'yes', 'no'}:
            answer = self.yes_no(text)
            return None if answer is None else ('yes' if answer else 'no')
        if not best:
            return None
        ranked = sorted(best.items(), key=lambda item: -item[1])
        if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
            return None
        return ranked[0][0]

    def language(self, text: str, current: str) -> str:
        """Switch to Hindi when the caller speaks it, back to English when they clearly speak English."""
        codes = {lang.code for lang in self.script.languages}
        if 'hi' in codes and current != 'hi' and looks_hindi(text):
            return 'hi'
        if current == 'hi' and looks_english(text) and len(text.split()) >= 4:
            return 'en'
        return current
