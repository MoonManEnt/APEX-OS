import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.paperclip_tasks import (
    PaperclipTask,
    PaperclipTaskCreateRequest,
    PaperclipTaskListResponse,
)
from app.core.settings import settings
from app.services.audit import record_audit


WORKSPACE_ROOT = Path(settings.workspace_root)
PAPERCLIP_DIR = WORKSPACE_ROOT / 'vpg_paperclip'
TASKS_PATH = PAPERCLIP_DIR / 'APEX_Paperclip_Tasks.json'
PAPERCLIP_CONFIG = PAPERCLIP_DIR / 'company_package' / '.paperclip.yaml'
DEFAULT_LANES = [
    'research-intelligence',
    'commercial-strategy',
    'technology-automation',
    'documentation-knowledge',
    'vpm-lane',
    'dispute2go-lane',
    'gtm-sales-lane',
    'ai-technology-lane',
    'influence-public-affairs-lane',
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_store() -> None:
    if TASKS_PATH.exists():
        return
    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TASKS_PATH.write_text(json.dumps({'items': []}, indent=2), encoding='utf-8')


def _load_raw() -> dict:
    _ensure_store()
    return json.loads(TASKS_PATH.read_text(encoding='utf-8'))


def _save_raw(payload: dict) -> None:
    TASKS_PATH.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def list_paperclip_lanes() -> list[str]:
    if not PAPERCLIP_CONFIG.exists():
        return DEFAULT_LANES
    lanes: list[str] = []
    for line in PAPERCLIP_CONFIG.read_text(encoding='utf-8').splitlines():
        stripped = line.strip()
        if stripped.startswith('- slug: '):
            lanes.append(stripped.replace('- slug: ', '').strip())
    return lanes or DEFAULT_LANES


def recommend_lane(event_type: Optional[str], primary_brand: Optional[str]) -> str:
    if event_type in {'ownership_transfer', 'lease_signed', 'lease_expiring', 'corporate_relocation'}:
        return 'gtm-sales-lane'
    if event_type in {'construction_start', 'construction_completion', 'permit_filed', 'zoning_action'}:
        return 'ai-technology-lane'
    if event_type in {'personnel_change', 'capital_raise', 'market_news'}:
        return 'research-intelligence'
    if primary_brand in {'clean_scapes', 'partners_cc', 'scout_security'}:
        return 'commercial-strategy'
    return 'ai-technology-lane'


def build_auto_task_request(
    *,
    event_id: str,
    title: str,
    summary: str,
    event_type: Optional[str],
    primary_brand: Optional[str],
) -> PaperclipTaskCreateRequest:
    lane = recommend_lane(event_type, primary_brand)
    return PaperclipTaskCreateRequest(
        title=f'APEX auto-sync — {title}',
        event_id=event_id,
        lane=lane,
        summary=summary,
    )


def list_tasks(event_id: Optional[str] = None) -> PaperclipTaskListResponse:
    payload = _load_raw()
    items = [PaperclipTask(**item) for item in payload.get('items', [])]
    if event_id:
        items = [item for item in items if item.event_id == event_id]
    items.sort(key=lambda item: item.updated_at, reverse=True)
    return PaperclipTaskListResponse(items=items)


def create_or_update_sync_task(request: PaperclipTaskCreateRequest) -> PaperclipTask:
    actor = request.operator_name or 'apex-system'
    payload = _load_raw()
    items = payload.get('items', [])
    existing = None
    if request.event_id:
        for item in items:
            if item.get('event_id') == request.event_id and item.get('lane') == request.lane:
                existing = item
                break

    timestamp = _now()
    if existing:
        existing['title'] = request.title
        existing['summary'] = request.summary
        existing['updated_at'] = timestamp
        existing.setdefault('comments', []).append(
            {'timestamp': timestamp, 'body': f'APEX sync refreshed this task from the newsroom surface by {actor}.'}
        )
        _save_raw(payload)
        task = PaperclipTask(**existing)
        record_audit(
            actor=actor,
            entity_type='paperclip_task',
            entity_id=task.id,
            event_id=task.event_id,
            action='paperclip_task_refreshed',
            summary=f'Refreshed Paperclip task in {task.lane}.',
            metadata={'lane': task.lane, 'status': task.status, 'operator_name': actor},
        )
        return task

    task = {
        'id': str(uuid.uuid4()),
        'title': request.title,
        'event_id': request.event_id,
        'lane': request.lane,
        'status': 'todo',
        'summary': request.summary,
        'created_at': timestamp,
        'updated_at': timestamp,
        'comments': [
            {'timestamp': timestamp, 'body': f'Task created by APEX newsroom tandem sync for {actor}.'}
        ],
    }
    items.append(task)
    _save_raw(payload)
    created = PaperclipTask(**task)
    record_audit(
        actor=actor,
        entity_type='paperclip_task',
        entity_id=created.id,
        event_id=created.event_id,
        action='paperclip_task_created',
        summary=f'Created Paperclip task in {created.lane}.',
        metadata={'lane': created.lane, 'status': created.status, 'operator_name': actor},
    )
    return created


def update_task_status(task_id: str, status: str, operator_name: Optional[str] = None) -> Optional[PaperclipTask]:
    actor = operator_name or 'apex-operator'
    payload = _load_raw()
    timestamp = _now()
    for item in payload.get('items', []):
        if item.get('id') == task_id:
            item['status'] = status
            item['updated_at'] = timestamp
            item.setdefault('comments', []).append(
                {'timestamp': timestamp, 'body': f'Status changed to {status} from APEX newsroom by {actor}.'}
            )
            _save_raw(payload)
            task = PaperclipTask(**item)
            record_audit(
                actor=actor,
                entity_type='paperclip_task',
                entity_id=task.id,
                event_id=task.event_id,
                action='paperclip_task_status_updated',
                summary=f'Updated Paperclip task status to {status}.',
                metadata={'lane': task.lane, 'status': status, 'operator_name': actor},
            )
            return task
    return None


def add_task_comment(task_id: str, body: str, operator_name: Optional[str] = None) -> Optional[PaperclipTask]:
    actor = operator_name or 'apex-operator'
    payload = _load_raw()
    timestamp = _now()
    for item in payload.get('items', []):
        if item.get('id') == task_id:
            item['updated_at'] = timestamp
            item.setdefault('comments', []).append(
                {'timestamp': timestamp, 'body': f'{actor}: {body}'}
            )
            _save_raw(payload)
            task = PaperclipTask(**item)
            record_audit(
                actor=actor,
                entity_type='paperclip_task',
                entity_id=task.id,
                event_id=task.event_id,
                action='paperclip_task_commented',
                summary='Added comment to Paperclip task.',
                metadata={'lane': task.lane, 'comment': body[:160], 'operator_name': actor},
            )
            return task
    return None
