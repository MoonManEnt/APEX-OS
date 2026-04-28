import json
import os
from pathlib import Path
from typing import Iterable

from app.models.paperclip import PaperclipContextItem, PaperclipContextResponse, PaperclipSyncEntry


WORKSPACE_ROOT = Path(os.environ.get('WORKSPACE_ROOT', str(Path(__file__).resolve().parents[2])))
PAPERCLIP_DIR = WORKSPACE_ROOT / 'vpg_paperclip'
SYNC_LOG_PATH = PAPERCLIP_DIR / 'APEX_Live_Sync_Log.json'
CONTEXT_FILES = [
    PAPERCLIP_DIR / 'VPG_Paperclip_Company_Spec.md',
    PAPERCLIP_DIR / 'VPG_Paperclip_Implementation_Roadmap.md',
    WORKSPACE_ROOT / 'APEX_Paperclip_Live_Sync_Policy.md',
]


def _excerpt(lines: Iterable[str], limit: int = 3) -> str:
    cleaned = [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]
    return ' '.join(cleaned[:limit])[:320]


def load_paperclip_context() -> PaperclipContextResponse:
    items: list[PaperclipContextItem] = []
    for path in CONTEXT_FILES:
        if not path.exists():
            continue
        content = path.read_text(encoding='utf-8').splitlines()
        items.append(
            PaperclipContextItem(
                title=path.stem.replace('_', ' '),
                source=str(path.relative_to(WORKSPACE_ROOT)),
                excerpt=_excerpt(content),
            )
        )

    latest_sync = None
    if SYNC_LOG_PATH.exists():
        payload = json.loads(SYNC_LOG_PATH.read_text(encoding='utf-8'))
        entries = payload.get('entries', [])
        if entries:
            latest_sync = PaperclipSyncEntry(**entries[0])

    return PaperclipContextResponse(
        status='live' if items else 'missing',
        items=items,
        latest_sync=latest_sync,
    )
