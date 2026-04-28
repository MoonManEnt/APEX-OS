from typing import Optional

from pydantic import BaseModel, Field


class PaperclipContextItem(BaseModel):
    title: str
    source: str
    excerpt: str


class PaperclipSyncEntry(BaseModel):
    timestamp: str
    workstream: str
    status: str
    summary: str
    verification: list[str] = Field(default_factory=list)


class PaperclipContextResponse(BaseModel):
    status: str
    items: list[PaperclipContextItem] = Field(default_factory=list)
    latest_sync: Optional[PaperclipSyncEntry] = None
