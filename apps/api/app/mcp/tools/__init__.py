from app.mcp.registry import Registry
from app.mcp.tools import events as events_tools


def build_registry() -> Registry:
    registry = Registry()
    events_tools.register(registry)
    return registry


_default_registry: Registry | None = None


def get_default_registry() -> Registry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_registry()
    return _default_registry
