"""Structured logs: ids, codes and counts only. Never transcripts, answers, names or phone numbers."""

from __future__ import annotations

import json
import sys
import time
from typing import Any

_FORBIDDEN = {'text', 'transcript', 'summary', 'answers', 'name', 'phone', 'email', 'utterance', 'reply'}


def log(level: str, event: str, **fields: Any) -> None:
    leaked = _FORBIDDEN.intersection(fields)
    if leaked:
        raise ValueError(f'refusing to log personal fields: {sorted(leaked)}')
    line = {'ts': round(time.time(), 3), 'level': level, 'event': event, **fields}
    print(json.dumps(line, ensure_ascii=False, default=str), file=sys.stderr, flush=True)
