import os


def _active_tools() -> set[str]:
    raw = os.environ.get('APEX_MCP_SENTRY_TOOLS', '')
    return {p.strip() for p in raw.split(',') if p.strip()}


def is_sentry_active(tool_name: str) -> bool:
    if not tool_name:
        return False
    return tool_name in _active_tools()
