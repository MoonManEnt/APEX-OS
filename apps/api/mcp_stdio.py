"""APEX MCP — stdio transport entry point.

Spawned by Claude Desktop and similar local clients. Reads JSON-RPC requests
from stdin, dispatches via the shared MCP registry, and writes responses to
stdout. Logs go to stderr.
"""

from __future__ import annotations

import asyncio
import json
import os

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from app.core.db import AsyncSessionLocal
from app.mcp.tools import get_default_registry


def _build_server() -> Server:
    registry = get_default_registry()
    server = Server('apex-mcp')

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        defs = registry.list_tools()
        return [
            Tool(
                name=d.name,
                description=d.description,
                inputSchema=d.input_schema or {'type': 'object', 'properties': {}},
            )
            for d in defs
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        async with AsyncSessionLocal() as session:
            ctx = {
                'session': session,
                'operator_id': os.environ.get('APEX_DEFAULT_OPERATOR_ID', 'apex-stdio'),
                'operator_name': os.environ.get('APEX_DEFAULT_OPERATOR_NAME', 'Stdio Operator'),
                'role': os.environ.get('APEX_DEFAULT_OPERATOR_ROLE', 'principal_operator'),
                'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
                'agent_id': os.environ.get('APEX_MCP_AGENT_ID', 'claude-desktop'),
                'agent_label': os.environ.get('APEX_MCP_AGENT_LABEL', 'Claude Desktop'),
            }
            result = await registry.dispatch_tool(name=name, ctx=ctx, params=arguments or {})
        return [TextContent(type='text', text=json.dumps(result, default=str))]

    return server


async def _main() -> None:
    server = _build_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == '__main__':
    asyncio.run(_main())
