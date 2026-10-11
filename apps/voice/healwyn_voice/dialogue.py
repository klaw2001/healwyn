"""The intake conversation: one state machine shared by the LiveKit voice agent, the typed chat,
the simulated dialer and the eval harness, so what is evaluated is exactly what runs.

consent → question (one at a time, from the pack) → confirm (→ fix) → closed

Every caller turn is checked for safety first (safety.py). Everything the assistant says comes
from the pack's script, never from a model.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from . import VERSION
from .contracts import VoiceCallResult, VoiceQuestion, VoiceScript
from .llm import OptionClassifier
from .nlu import Understanding
from .safety import SafetyChecker

State = Literal['consent', 'question', 'confirm', 'fix', 'closed']
URGENCY_RANK = {'low': 0, 'normal': 1, 'high': 2, 'urgent': 3}
MAX_UTTERANCE = 1000


@dataclass(frozen=True)
class Reply:
    text: str
    end: bool = False


class IntakeSession:
    def __init__(
        self,
        script: VoiceScript,
        *,
        call_id: str | None = None,
        lead_id: str,
        channel: Literal['browser', 'phone', 'simulated', 'text'],
        language: str = 'en',
        classifier: OptionClassifier | None = None,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.script = script
        self.call_id = call_id or str(uuid.uuid4())
        self.lead_id = lead_id
        self.channel = channel
        codes = {lang.code for lang in script.languages}
        self.lang = language if language in codes else 'en'
        self.classifier = classifier
        self.nlu = Understanding(script)
        self.safety = SafetyChecker(script)
        self._clock = clock
        self._now = now
        self._started = clock()
        self._last_activity = self._started
        self._ended_clock: float | None = None
        self.started_at = now()
        self.ended_at: datetime | None = None

        self.state: State = 'consent'
        self.consent = False
        self.answers: dict[str, str] = {}
        self.attempts: dict[str, int] = {}
        self.index = 0
        self.flags: list[dict] = []
        self.transcript: list[dict] = []
        self.outcome: str | None = None
        self.urgency = 'normal'
        self.turns = 0
        self.consent_attempts = 0
        self.confirm_attempts = 0
        self.fix_rounds = 0
        self.tts_characters = 0
        self.stt_seconds = 0.0

    # -- helpers ---------------------------------------------------------------------------------

    @property
    def ended(self) -> bool:
        return self.state == 'closed'

    def elapsed(self) -> float:
        end = self._ended_clock if self._ended_clock is not None else self._clock()
        return max(0.0, end - self._started)

    def idle_seconds(self) -> float:
        return max(0.0, self._clock() - self._last_activity)

    def t(self, text: dict[str, str], **tokens: str) -> str:
        line = text.get(self.lang) or text['en']
        for key, value in tokens.items():
            line = line.replace('{' + key + '}', value)
        return line

    def _say(self, *parts: str, end: bool = False) -> Reply:
        text = ' '.join(p.strip() for p in parts if p and p.strip())
        self.transcript.append({'speaker': 'assistant', 'text': text[:2000], 'atSeconds': round(self.elapsed(), 2)})
        self.tts_characters += len(text)
        if end:
            self._close_state()
        return Reply(text, end)

    def _close_state(self, at_last_activity: bool = False) -> None:
        self.state = 'closed'
        self._ended_clock = self._last_activity if at_last_activity else self._clock()
        self.ended_at = self._now()

    def _flag(self, kind: str, code: str) -> None:
        self.flags.append({'kind': kind, 'code': code, 'turn': self.turns})

    def _raise_urgency(self, level: str) -> None:
        if URGENCY_RANK[level] > URGENCY_RANK[self.urgency]:
            self.urgency = level

    @property
    def question(self) -> VoiceQuestion | None:
        return self.script.questions[self.index] if self.index < len(self.script.questions) else None

    def _prompt(self) -> str:
        if self.state == 'consent':
            return self.t(self.script.consentQuestion)
        if self.state == 'question' and self.question:
            return self.t(self.question.prompt)
        if self.state in {'confirm', 'fix'}:
            return self._confirm_line()
        return ''

    def _label(self, question: VoiceQuestion, value: str, lang: str | None = None) -> str:
        lang = lang or self.lang
        for option in question.options:
            if option.value == value:
                return option.label.get(lang) or option.label['en']
        return value

    # -- the conversation ------------------------------------------------------------------------

    def start(self) -> Reply:
        return self._say(self.t(self.script.greeting))

    def handle(self, utterance: str) -> Reply:
        if self.ended:
            return Reply('', end=True)
        text = utterance.strip()[:MAX_UTTERANCE]
        self._last_activity = self._clock()
        self.transcript.append({'speaker': 'caller', 'text': text[:2000], 'atSeconds': round(self.elapsed(), 2)})
        self.turns += 1

        if not text:
            return self._say(self.t(self.script.reprompts.unclear, question=self._prompt()))

        self.lang = self.nlu.language(text, self.lang)
        check = self.safety.check(text)

        # 1. Emergencies stop everything.
        if check.red_flag:
            self._flag('red_flag', check.red_flag)
            self._raise_urgency('urgent')
            self.outcome = 'emergency'
            return self._say(self.t(self.script.safety.emergencyMessage), end=True)
        if check.high_urgency:
            self._raise_urgency('high')

        # 2. Limits.
        limits = self.script.limits
        if self.turns > limits.maxTurns or self.elapsed() > limits.maxCallSeconds:
            return self.time_up()

        # 3. The caller wants to go.
        if self.nlu.wants_hangup(text) and not (self.state == 'question' and self._is_free_text()):
            # Saying goodbye when asked whether to continue is a clear no.
            self.outcome = 'consent_declined' if self.state == 'consent' else 'caller_ended'
            return self._say(self.t(self.script.goodbye), end=True)

        # 4. Rule changes and identity questions get a fixed answer, then the same question again.
        if check.injection:
            self._flag('prompt_injection', 'instruction_change')
            return self._say(self.t(self.script.safety.injectionReply), self._prompt())
        if check.identity_question:
            return self._say(self.t(self.script.identity.reply), self._prompt())

        if self.state == 'consent':
            return self._handle_consent(text, check.advice_request)
        if self.state == 'question':
            return self._handle_answer(text, check.advice_request)
        if self.state == 'confirm':
            return self._handle_confirm(text)
        return self._handle_fix(text)

    def _handle_consent(self, text: str, advice: bool) -> Reply:
        answer = self.nlu.yes_no(text)
        if advice:
            self._flag('advice_request', self.script.safety.adviceCode)
            if answer is None:
                return self._say(self.t(self.script.safety.adviceDecline), self._prompt())
        if answer is True:
            self.consent = True
            self.state = 'question'
            return self._say(self.t(self.question.prompt) if self.question else '')
        if answer is False:
            self.outcome = 'consent_declined'
            return self._say(self.t(self.script.consentDeclined), end=True)
        self.consent_attempts += 1
        if self.consent_attempts >= 2:
            # Still no clear yes: collect nothing, but this is not a "no", so the call consent stays.
            self.outcome = 'no_consent'
            return self._say(self.t(self.script.consentDeclined), end=True)
        return self._say(self.t(self.script.reprompts.unclear, question=self._prompt()))

    def _is_free_text(self) -> bool:
        return bool(self.question) and self.question.kind in {'text', 'textarea'}

    def _understand(self, question: VoiceQuestion, text: str, *, use_model: bool = True) -> str | None:
        value = self.nlu.option_for(question, text)
        if value is None and use_model and self.classifier is not None:
            value = self.classifier.classify(question, text, self.lang)
            # Never trust a model's output: only an exact option value is accepted.
            if value not in {option.value for option in question.options}:
                value = None
        return value

    def _advance(self, *prefix: str) -> Reply:
        self.index += 1
        if self.question:
            return self._say(*prefix, self.t(self.question.prompt))
        return self._enter_confirm(*prefix)

    def _handle_answer(self, text: str, advice: bool) -> Reply:
        question = self.question
        assert question is not None
        prefix: list[str] = []
        if advice:
            self._flag('advice_request', self.script.safety.adviceCode)
            prefix.append(self.t(self.script.safety.adviceDecline))

        if self._is_free_text():
            # "Nothing", "skip": a short answer that only declines. Longer answers are content.
            if (self.nlu.wants_skip(text) and len(text.split()) <= 4) or advice:
                return self._advance(*prefix, self.t(self.script.reprompts.skipped) if not advice else '')
            limit = question.maxLength.root if question.maxLength is not None else 500
            self.answers[question.id] = text[:limit]
            return self._advance(*prefix)

        # An advice request is a question, not an answer: accept an option the caller names
        # outright ("a kitchen, and can the wall go?"), but never let the model guess one from it.
        value = self._understand(question, text, use_model=not advice)
        if value is not None:
            self.answers[question.id] = value
            return self._advance(*prefix)
        if not question.required and self.nlu.wants_skip(text):
            return self._advance(*prefix, self.t(self.script.reprompts.skipped))
        if advice:
            return self._say(*prefix, self.t(question.prompt))

        self.attempts[question.id] = self.attempts.get(question.id, 0) + 1
        if self.attempts[question.id] == 1:
            template = self.script.reprompts.offTopic if len(text.split()) > 8 else self.script.reprompts.unclear
            return self._say(*prefix, self.t(template, question=self.t(question.prompt)))
        if question.id == self.script.offeringQuestionId:
            self.answers[question.id] = self.script.offeringUnsureValue
        return self._advance(*prefix, self.t(self.script.reprompts.moveOn))

    def _confirm_line(self) -> str:
        parts = []
        for question in self.script.questions:
            if question.confirm is None or question.id not in self.answers:
                continue
            answer = self._label(question, self.answers[question.id]) if question.options else self.answers[question.id]
            parts.append(self.t(question.confirm, answer=answer))
        if not parts:
            return ''
        joiner = ' और ' if self.lang == 'hi' else ', and '
        summary = parts[0] if len(parts) == 1 else ', '.join(parts[:-1]) + joiner + parts[-1]
        return self.t(self.script.confirm.ask, summary=summary)

    def _enter_confirm(self, *prefix: str) -> Reply:
        line = self._confirm_line()
        if not line:
            return self._close(*prefix)
        self.state = 'confirm'
        return self._say(*prefix, line)

    def _corrections(self, text: str) -> bool:
        changed = False
        for question in self.script.questions:
            if not question.options or {o.value for o in question.options} == {'yes', 'no'}:
                continue
            value = self.nlu.option_for(question, text)
            if value is not None and self.answers.get(question.id) != value:
                self.answers[question.id] = value
                changed = True
        return changed

    def _handle_confirm(self, text: str) -> Reply:
        answer = self.nlu.yes_no(text)
        corrected = self._corrections(text)
        if corrected:
            self.fix_rounds += 1
            return self._say(self._confirm_line()) if self.fix_rounds < 3 else self._close()
        if answer is True:
            return self._close()
        if answer is False:
            self.state = 'fix'
            self.fix_rounds += 1
            return self._say(self.t(self.script.confirm.fix))
        self.confirm_attempts += 1
        if self.confirm_attempts >= 2:
            return self._close(self.t(self.script.reprompts.moveOn))
        return self._say(self.t(self.script.reprompts.unclear, question=self._confirm_line()))

    def _handle_fix(self, text: str) -> Reply:
        if self._corrections(text) and self.fix_rounds < 3:
            self.state = 'confirm'
            return self._say(self._confirm_line())
        return self._close(self.t(self.script.reprompts.moveOn))

    def _close(self, *prefix: str) -> Reply:
        self.outcome = 'completed'
        callback = self.script.callback
        phrase = callback.phrases.get(self.answers.get(callback.questionId, ''), callback.fallback)
        return self._say(*prefix, self.t(self.script.closing, time=self.t(phrase)), end=True)

    # -- endings from outside the conversation ----------------------------------------------------

    def time_up(self) -> Reply:
        if self.ended:
            return Reply('', end=True)
        self.outcome = 'limit_reached'
        return self._say(self.t(self.script.limitReached), end=True)

    def caller_hung_up(self, idle: bool = False) -> None:
        """The caller left. When they simply went quiet (`idle`), the call is timed to their last turn."""
        if self.ended:
            return
        # Leaving (or never answering) is not declining: only an explicit no withdraws the call consent.
        self.outcome = 'caller_ended'
        self._close_state(at_last_activity=idle)

    def failed(self) -> None:
        if not self.ended:
            self.outcome = 'error'
            self._close_state()

    # -- the result posted to the CRM ----------------------------------------------------------------

    def summary(self) -> list[str]:
        labels = {q.id: q for q in self.script.questions}
        lines: list[str] = []
        red = [f for f in self.flags if f['kind'] == 'red_flag']
        if red:
            names = {flag.id: flag.label for flag in self.script.safety.redFlags}
            flags = ', '.join(names.get(f['code'], f['code']) for f in red)
            lines.append(self.script.staffNotes.redFlag.replace('{flags}', flags))
        for template in self.script.summary:
            line = template
            missing = False
            for qid, question in labels.items():
                token = '{' + qid + '}'
                if token not in line:
                    continue
                if qid not in self.answers:
                    missing = True
                    break
                value = self.answers[qid]
                shown = self._label(question, value, 'en') if question.options else value[:160]
                line = line.replace(token, shown)
            if not missing:
                lines.append(line[:300])
        if any(f['kind'] == 'advice_request' for f in self.flags):
            lines.append(self.script.staffNotes.advice)
        if any(f['kind'] == 'prompt_injection' for f in self.flags):
            lines.append("Tried to change the assistant's instructions; refused.")
        language = next((lang.label for lang in self.script.languages if lang.code == self.lang), self.lang)
        seconds = self.elapsed()
        length = 'under a minute' if seconds < 60 else f'about {round(seconds / 60)} min'
        meta = {
            'completed': f'Assistant call in {language}, {length}; the caller confirmed the details.',
            'emergency': f'Assistant call in {language} stopped for emergency advice.',
            'consent_declined': 'The caller did not want to continue with the assistant; nothing was collected.',
            'no_consent': 'The caller did not clearly agree to continue with the assistant; nothing was collected.',
            'caller_ended': f'The caller ended the call early ({language}); details may be incomplete.'
            if self.consent
            else 'The call ended before the caller agreed to continue; nothing was collected.',
            'limit_reached': f'The call reached its time limit ({language}); details may be incomplete.',
            'error': 'The call failed; please call them back.',
        }.get(self.outcome or 'error', '')
        lines.append(meta)
        return [line for line in lines if line][:5]

    def _kept_transcript(self) -> list[dict]:
        """Before the caller agrees to continue, their words are not kept (the assistant's lines are)."""
        if self.consent:
            return self.transcript
        return [
            turn
            if turn['speaker'] == 'assistant'
            else {**turn, 'text': '[not kept: the caller had not agreed to continue]'}
            for turn in self.transcript
        ]

    def result(self) -> VoiceCallResult:
        ended = self.ended_at or self._now()
        answers = {} if not self.consent else dict(self.answers)
        return VoiceCallResult.model_validate(
            {
                'version': 1,
                'callId': self.call_id,
                'leadId': self.lead_id,
                'channel': self.channel,
                'startedAt': self.started_at.isoformat(),
                'endedAt': ended.isoformat(),
                'durationSeconds': min(7200, round(self.elapsed())),
                'language': self.lang,
                'consentToContinue': self.consent,
                'outcome': self.outcome or 'error',
                'urgency': self.urgency,
                'answers': answers,
                'safetyFlags': self.flags[:50],
                'summary': self.summary(),
                'transcript': self._kept_transcript()[:200],
                'usage': {
                    'llmRequests': self.classifier.requests if self.classifier else 0,
                    'sttSeconds': round(self.stt_seconds, 1),
                    'ttsCharacters': self.tts_characters,
                },
                'agentVersion': VERSION,
            }
        )
