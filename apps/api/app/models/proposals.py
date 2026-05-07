from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProposalStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    EXPIRED = 'expired'


class ApprovalSource(str, Enum):
    UI = 'ui'
    MCP = 'mcp'
    SENTRY = 'sentry'


class ProposalCreate(BaseModel):
    agent_id: str
    agent_label: Optional[str] = None
    operator_id: str
    tool_name: str
    payload: dict[str, Any]
    summary: str
    request_id: Optional[str] = None
    expires_at: datetime


class ProposedAction(BaseModel):
    id: str
    agent_id: str
    agent_label: Optional[str] = None
    operator_id: str
    tool_name: str
    payload: dict[str, Any]
    summary: str
    status: ProposalStatus
    approval_source: Optional[ApprovalSource] = None
    approved_by: Optional[str] = None
    approver_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    request_id: Optional[str] = None
    expires_at: str
    created_at: str
    approved_at: Optional[str] = None
    executed_at: Optional[str] = None
    execution_result: Optional[dict[str, Any]] = None


class ProposalDecision(BaseModel):
    proposal_id: str
    approver_id: str
    source: ApprovalSource
    approver_note: Optional[str] = None
    rejection_reason: Optional[str] = None


class ProposalListResponse(BaseModel):
    proposals: list[ProposedAction] = Field(default_factory=list)
