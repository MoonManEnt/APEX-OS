from typing import Optional

from pydantic import BaseModel, Field


class PaperclipTaskComment(BaseModel):
    timestamp: str
    body: str


class PaperclipTask(BaseModel):
    id: str
    title: str
    event_id: Optional[str] = None
    lane: str
    status: str
    summary: str
    created_at: str
    updated_at: str
    comments: list[PaperclipTaskComment] = Field(default_factory=list)


class PaperclipTaskListResponse(BaseModel):
    items: list[PaperclipTask] = Field(default_factory=list)


class PaperclipTaskCreateRequest(BaseModel):
    title: str
    event_id: Optional[str] = None
    lane: str
    summary: str
    operator_name: Optional[str] = None


class PaperclipTaskStatusRequest(BaseModel):
    status: str
    operator_name: Optional[str] = None


class PaperclipTaskCommentRequest(BaseModel):
    body: str
    operator_name: Optional[str] = None
