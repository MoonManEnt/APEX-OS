"""APEX MCP — HTTP/SSE transport adapter.

Mounted on the FastAPI app at /mcp/sse. Agents connect via Server-Sent Events
and dispatch tool calls through the shared MCP registry. The X-MCP-Agent-Id
header is required; X-Apex-Operator-* headers (forwarded from the FastAPI
session machinery) carry operator identity.
"""

from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.core.db import AsyncSessionLocal
from app.mcp.tools import get_default_registry


router = APIRouter()


@router.get('/mcp/sse')
async def mcp_sse(
    request: Request,
    x_mcp_agent_id: Optional[str] = Header(default=None),
    x_mcp_agent_label: Optional[str] = Header(default=None),
    x_apex_operator_id: Optional[str] = Header(default=None),
    x_apex_operator_name: Optional[str] = Header(default=None),
    x_apex_operator_role: Optional[str] = Header(default=None),
):
    if not x_mcp_agent_id:
        raise HTTPException(status_code=401, detail='X-MCP-Agent-Id required for remote MCP transport')

    registry = get_default_registry()

    async def event_stream():
        tools = [
            {'name': t.name, 'description': t.description, 'input_schema': t.input_schema}
            for t in registry.list_tools()
        ]
        yield {'event': 'ready', 'data': json.dumps({'tools': tools})}

        while not await request.is_disconnected():
            yield {'event': 'heartbeat', 'data': '{}'}
            await asyncio.sleep(15)

    return EventSourceResponse(event_stream())


@router.post('/mcp/dispatch')
async def mcp_dispatch(
    body: dict,
    x_mcp_agent_id: Optional[str] = Header(default=None),
    x_mcp_agent_label: Optional[str] = Header(default=None),
    x_apex_operator_id: Optional[str] = Header(default=None),
    x_apex_operator_name: Optional[str] = Header(default=None),
    x_apex_operator_role: Optional[str] = Header(default=None),
):
    """Out-of-band tool dispatch for HTTP clients.

    Body: { "tool": "<name>", "params": {...} }.
    Mirrors stdio behavior over a plain JSON request/response.
    """
    if not x_mcp_agent_id:
        raise HTTPException(status_code=401, detail='X-MCP-Agent-Id required for remote MCP transport')

    tool_name = body.get('tool')
    params = body.get('params') or {}
    if not tool_name:
        raise HTTPException(status_code=400, detail='`tool` field is required')

    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = {
            'session': session,
            'operator_id': x_apex_operator_id or 'apex-mcp',
            'operator_name': x_apex_operator_name or 'MCP Operator',
            'role': x_apex_operator_role or 'principal_operator',
            'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
            'agent_id': x_mcp_agent_id,
            'agent_label': x_mcp_agent_label,
        }
        result = await registry.dispatch_tool(name=tool_name, ctx=ctx, params=params)
    return {'tool': tool_name, 'result': result}
