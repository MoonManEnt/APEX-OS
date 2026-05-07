from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional


ToolHandler = Callable[[dict, dict], Awaitable[Any]]


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)


@dataclass
class ResourceDefinition:
    uri: str
    name: str
    description: str
    mime_type: str = 'application/json'


ResourceHandler = Callable[[dict, dict], Awaitable[Any]]


class ToolNotFoundError(LookupError):
    pass


class ResourceNotFoundError(LookupError):
    pass


class Registry:
    def __init__(self) -> None:
        self._tools: dict[str, tuple[ToolDefinition, ToolHandler]] = {}
        self._resources: dict[str, tuple[ResourceDefinition, ResourceHandler]] = {}

    def register_tool(self, defn: ToolDefinition, handler: ToolHandler) -> None:
        if defn.name in self._tools:
            raise ValueError(f'Tool already registered: {defn.name}')
        self._tools[defn.name] = (defn, handler)

    def register_resource(self, defn: ResourceDefinition, handler: ResourceHandler) -> None:
        if defn.uri in self._resources:
            raise ValueError(f'Resource already registered: {defn.uri}')
        self._resources[defn.uri] = (defn, handler)

    def list_tools(self) -> list[ToolDefinition]:
        return [d for d, _ in self._tools.values()]

    def list_resources(self) -> list[ResourceDefinition]:
        return [d for d, _ in self._resources.values()]

    async def dispatch_tool(self, *, name: str, ctx: dict, params: dict) -> Any:
        if name not in self._tools:
            raise ToolNotFoundError(name)
        _, handler = self._tools[name]
        return await handler(ctx, params)

    async def read_resource(self, *, uri: str, ctx: dict, params: Optional[dict] = None) -> Any:
        if uri not in self._resources:
            raise ResourceNotFoundError(uri)
        _, handler = self._resources[uri]
        return await handler(ctx, params or {})
