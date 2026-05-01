from typing import Optional

from pydantic import BaseModel, Field


class SignalItem(BaseModel):
    id: str
    title: str
    confidence_score: float = 0.0
    primary_brand: Optional[str] = None
    market: Optional[str] = None
    event_at: Optional[str] = None


class PropertyListItem(BaseModel):
    id: str
    name: Optional[str] = None
    market: Optional[str] = None
    building_type: str = 'other'
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    source: str = 'auto'
    brands: list[str] = Field(default_factory=list)
    score: Optional[float] = None
    signal_count: int = 0
    created_at: str
    updated_at: str


class PropertyDetail(PropertyListItem):
    linked_signals: list[SignalItem] = Field(default_factory=list)


class PropertyCreateRequest(BaseModel):
    name: str
    market: Optional[str] = None
    building_type: str = 'other'
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    brands: list[str] = Field(default_factory=list)


class PropertyUpdateRequest(BaseModel):
    name: Optional[str] = None
    market: Optional[str] = None
    building_type: Optional[str] = None
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    brands: Optional[list[str]] = None
