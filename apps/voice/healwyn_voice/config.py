"""Configuration from the environment (and the repo's root .env when present)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .contracts import VoiceScript

APP_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = APP_DIR.parent.parent


def load_env_file(path: Path = REPO_ROOT / '.env') -> None:
    """Loads KEY=value lines into os.environ without overriding variables already set."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        os.environ.setdefault(key, value)


class RealDataRefused(RuntimeError):
    """The free Gemini tier may use inputs to improve Google's products: synthetic data only."""


@dataclass(frozen=True)
class Settings:
    pack: str
    script_path: Path
    script_dir: Path
    crm_url: str
    webhook_secret: str
    agent_secret: str
    gemini_api_key: str
    llm_model: str
    use_llm: bool
    text_host: str
    text_port: int
    stt_model: str
    tts_model: str
    tts_voice: str
    agent_name: str


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    return default if value is None or value == '' else value.strip().lower() in {'1', 'true', 'yes', 'on'}


def settings() -> Settings:
    load_env_file()
    if _flag('VOICE_REAL_DATA', False):
        raise RealDataRefused(
            'VOICE_REAL_DATA is true, but this assistant runs on the free Gemini tier, whose inputs may be used to '
            'improve Google products. Use synthetic data only, or move to a paid tier and remove this guard.'
        )
    pack = os.environ.get('VOICE_PACK', 'clinic')
    script_dir = Path(os.environ.get('VOICE_SCRIPT_DIR') or REPO_ROOT / 'packages' / 'core' / 'contracts')
    default_script = script_dir / f'voice-script.{pack}.json'
    url = os.environ.get('VOICE_TEXT_URL', 'http://127.0.0.1:8090')
    host, _, port = url.split('://', 1)[-1].partition(':')
    return Settings(
        pack=pack,
        script_path=Path(os.environ.get('VOICE_SCRIPT_PATH') or default_script),
        script_dir=script_dir,
        crm_url=os.environ.get('CRM_URL', 'http://localhost:3001').rstrip('/'),
        webhook_secret=os.environ.get('VOICE_WEBHOOK_SECRET', ''),
        agent_secret=os.environ.get('VOICE_AGENT_SECRET', ''),
        gemini_api_key=os.environ.get('GEMINI_API_KEY', ''),
        llm_model=os.environ.get('VOICE_LLM_MODEL', 'gemini-3.5-flash-lite'),
        use_llm=_flag('VOICE_USE_LLM', True),
        text_host=host or '127.0.0.1',
        text_port=int(port.split('/')[0] or 8090),
        stt_model=os.environ.get('VOICE_STT_MODEL', 'deepgram/nova-3'),
        tts_model=os.environ.get('VOICE_TTS_MODEL', 'rime/coda'),
        tts_voice=os.environ.get('VOICE_TTS_VOICE', ''),
        agent_name=os.environ.get('VOICE_AGENT_NAME', 'healwyn-intake'),
    )


@lru_cache(maxsize=4)
def load_script(path: str) -> VoiceScript:
    return VoiceScript.model_validate_json(Path(path).read_text(encoding='utf-8'))


def default_script() -> VoiceScript:
    return load_script(str(REPO_ROOT / 'packages' / 'core' / 'contracts' / 'voice-script.clinic.json'))


PACK_ID = re.compile(r'[a-z][a-z0-9_]{0,39}')


def script_for(config: Settings, pack: str | None) -> VoiceScript:
    """The voice script of an industry pack (`voice-script.<pack>.json` in the script folder).

    Raises ValueError for a malformed or unknown pack id.
    """
    pack = pack or config.pack
    if not PACK_ID.fullmatch(pack):
        raise ValueError('pack')
    path = config.script_path if pack == config.pack else config.script_dir / f'voice-script.{pack}.json'
    if not path.is_file():
        raise ValueError('pack')
    script = load_script(str(path))
    if script.packId != pack:
        raise ValueError('pack')
    return script
