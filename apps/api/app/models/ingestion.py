from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class RawScrapePayload(BaseModel):
    source_name: str
    source_url: HttpUrl
    title: Optional[str] = None
    raw_text: Optional[str] = None
    published_at: Optional[str] = None
    payload: dict = Field(default_factory=dict)


class ClassificationResult(BaseModel):
    title: str
    summary: Optional[str] = None
    event_type: str = 'other'
    market: Optional[str] = None
    urgency_score: int = 0
    relevance_score: int = 0
    confidence_score: float = 0.0
    primary_brand: Optional[str] = None
    brand_relevance: list[str] = Field(default_factory=list)
    badges: list[str] = Field(default_factory=list)
    rationale: Optional[str] = None
    extracted_entities: dict = Field(default_factory=dict)
