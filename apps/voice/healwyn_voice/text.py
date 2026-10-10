"""Text normalisation and phrase matching that works for English, Hindi (Devanagari) and Hinglish.

Phrases match on word boundaries. Latin phrases must match whole words; Devanagari phrases may
continue their last word, because Hindi inflects at the end ("दौरा पड़" matches "दौरा पड़ा").
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass

_PUNCTUATION = re.compile(r"[^\w\sऀ-ॿ'-]", re.UNICODE)
_SPACES = re.compile(r'\s+')
_DEVANAGARI = re.compile(r'[ऀ-ॿ]')
_ROMAN_HINDI = {
    'hai',
    'haan',
    'nahi',
    'nahin',
    'mujhe',
    'mera',
    'meri',
    'mere',
    'aap',
    'kya',
    'kyun',
    'kaise',
    'ke',
    'ka',
    'ki',
    'mein',
    'bhi',
    'theek',
    'thik',
    'dard',
    'karna',
    'chahiye',
    'chahta',
    'chahti',
    'batao',
    'bataiye',
    'abhi',
    'kal',
    'subah',
    'shaam',
    'dopahar',
    'pehli',
    'baar',
    'ji',
    'accha',
    'acha',
    'bahut',
    'hoon',
    'hun',
    'raha',
    'rahi',
}


def normalize(text: str) -> str:
    """Lower case, Unicode NFC, punctuation to spaces (apostrophes and hyphens kept), spaces collapsed."""
    text = unicodedata.normalize('NFC', text).lower()
    text = text.replace('’', "'").replace('‘', "'").replace('।', ' ')
    text = _PUNCTUATION.sub(' ', text)
    return _SPACES.sub(' ', text).strip()


def tokens(text: str) -> list[str]:
    return normalize(text).split(' ') if text.strip() else []


def is_devanagari(text: str) -> bool:
    return bool(_DEVANAGARI.search(text))


@dataclass(frozen=True)
class Match:
    phrase: str
    start: int  # token index where the phrase starts
    length: int  # number of tokens


def find_phrases(text: str, phrases: Iterable[str]) -> list[Match]:
    """Every occurrence of every phrase in text, on token boundaries."""
    words = tokens(text)
    found: list[Match] = []
    for phrase in phrases:
        target = tokens(phrase)
        if not target:
            continue
        loose_end = is_devanagari(target[-1])
        n = len(target)
        for i in range(len(words) - n + 1):
            window = words[i : i + n]
            if window[:-1] != target[:-1]:
                continue
            last_ok = window[-1].startswith(target[-1]) if loose_end else window[-1] == target[-1]
            if last_ok:
                found.append(Match(phrase, i, n))
    return found


def contains_any(text: str, phrases: Iterable[str]) -> bool:
    return bool(find_phrases(text, phrases))


def looks_hindi(text: str) -> bool:
    """Devanagari script, or at least two common romanised Hindi words."""
    if is_devanagari(text):
        return True
    return sum(1 for w in tokens(text) if w in _ROMAN_HINDI) >= 2


def looks_english(text: str) -> bool:
    words = tokens(text)
    return bool(words) and not is_devanagari(text) and sum(1 for w in words if w in _ROMAN_HINDI) == 0
