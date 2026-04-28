from typing import Optional

from pydantic import BaseModel, Field


class ActionDraftResponse(BaseModel):
    event_id: str
    title: str
    body: str
    audience: str
    recommended_brand: str
    why_it_matters: str
    signal_posture: str
    model_name: str
    used_fallback: bool = Field(default=True)
    context_notes: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    updated_at: Optional[str] = None
    draft_type: str = 'primary_outreach'
    draft_status: str = 'generated'
    edited_by_operator: bool = False


class ActionDraftHistoryItem(BaseModel):
    action_id: str
    title: str
    body: str
    model_name: str
    used_fallback: bool = True
    updated_at: Optional[str] = None
    draft_type: str = 'primary_outreach'
    draft_status: str = 'generated'
    edited_by_operator: bool = False


class ActionDraftHistoryResponse(BaseModel):
    event_id: str
    items: list[ActionDraftHistoryItem] = Field(default_factory=list)


class ActionReviewQueueItem(BaseModel):
    action_id: str
    event_id: str
    title: str
    recommended_brand: str
    draft_type: str = 'primary_outreach'
    draft_status: str = 'generated'
    updated_at: Optional[str] = None
    operator_name: Optional[str] = None
    assigned_reviewer_name: Optional[str] = None
    reviewed_by_name: Optional[str] = None


class ActionReviewQueueResponse(BaseModel):
    items: list[ActionReviewQueueItem] = Field(default_factory=list)


class ActionDraftRequest(BaseModel):
    event_id: str
    event_title: str
    event_summary: Optional[str] = None
    event_type: Optional[str] = None
    market: Optional[str] = None
    primary_brand: Optional[str] = None
    confidence_score: Optional[float] = None
    badges: list[str] = Field(default_factory=list)
    draft_type: str = 'primary_outreach'


class ActionDraftUpdateRequest(BaseModel):
    event_id: str
    title: str
    body: str
    audience: str
    recommended_brand: str
    why_it_matters: str
    signal_posture: str
    context_notes: list[str] = Field(default_factory=list)
    draft_type: str = 'primary_outreach'
    draft_status: str = 'edited'
    operator_name: Optional[str] = None
    assigned_reviewer_name: Optional[str] = None
