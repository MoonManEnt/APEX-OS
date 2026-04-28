from typing import Optional

from pydantic import BaseModel, Field


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    actor: str
    entity_type: str
    entity_id: str
    event_id: Optional[str] = None
    action: str
    summary: str
    metadata: dict = Field(default_factory=dict)


class AuditListResponse(BaseModel):
    items: list[AuditEntry] = Field(default_factory=list)
