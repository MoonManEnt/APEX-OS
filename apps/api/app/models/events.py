from typing import Optional

from pydantic import BaseModel, Field


class EventFilters(BaseModel):
    brand: Optional[str] = None
    market: Optional[str] = None
    event_type: Optional[str] = None
    min_score: Optional[int] = None
    since: Optional[str] = None


class EventListItem(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    event_type: str = Field(default='other')
    market: Optional[str] = None
    urgency_score: int = 0
    relevance_score: int = 0
    confidence_score: float = 0.0
    primary_brand: Optional[str] = None
    brand_relevance: list[str] = Field(default_factory=list)
    badges: list[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    event_at: Optional[str] = None
    latest_draft_type: Optional[str] = None
    latest_draft_status: Optional[str] = None
    latest_draft_updated_at: Optional[str] = None
    created_at: Optional[str] = None


class EventDetail(EventListItem):
    raw_scrape_id: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class EventListResponse(BaseModel):
    events: list[EventListItem] = Field(default_factory=list)
