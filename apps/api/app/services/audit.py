import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.core.settings import settings
from app.models.audit import AuditEntry, AuditListResponse


WORKSPACE_ROOT = Path(settings.workspace_root)
AUDIT_PATH = WORKSPACE_ROOT / 'vpg_paperclip' / 'APEX_Audit_Log.json'


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_store() -> None:
    if AUDIT_PATH.exists():
        return
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_PATH.write_text(json.dumps({'items': []}, indent=2), encoding='utf-8')


def _load_raw() -> dict:
    _ensure_store()
    return json.loads(AUDIT_PATH.read_text(encoding='utf-8'))


def _save_raw(payload: dict) -> None:
    AUDIT_PATH.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def record_audit(
    *,
    actor: str,
    entity_type: str,
    entity_id: str,
    action: str,
    summary: str,
    event_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> AuditEntry:
    payload = _load_raw()
    entry = AuditEntry(
        id=str(uuid.uuid4()),
        timestamp=_now(),
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        event_id=event_id,
        action=action,
        summary=summary,
        metadata=metadata or {},
    )
    payload['items'].append(entry.model_dump())
    _save_raw(payload)
    return entry


def list_audit(event_id: Optional[str] = None, entity_type: Optional[str] = None) -> AuditListResponse:
    payload = _load_raw()
    items = [AuditEntry(**item) for item in payload.get('items', [])]
    if event_id:
        items = [item for item in items if item.event_id == event_id]
    if entity_type:
        items = [item for item in items if item.entity_type == entity_type]
    items.sort(key=lambda item: item.timestamp, reverse=True)
    return AuditListResponse(items=items[:50])
