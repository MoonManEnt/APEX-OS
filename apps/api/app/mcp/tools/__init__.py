from app.mcp.registry import Registry
from app.mcp.tools import (
    accounts as accounts_tools,
    drafts as drafts_tools,
    events as events_tools,
    paperclip as paperclip_tools,
    session as session_tools,
)


def build_registry() -> Registry:
    registry = Registry()
    events_tools.register(registry)
    accounts_tools.register(registry)
    drafts_tools.register(registry)
    paperclip_tools.register(registry)
    session_tools.register(registry)
    return registry


_default_registry: Registry | None = None


def get_default_registry() -> Registry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_registry()
    return _default_registry
