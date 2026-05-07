from fastapi import WebSocket


class FeedConnectionManager:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        for connection in list(self._connections):
            await connection.send_json(message)


feed_manager = FeedConnectionManager()


# WebSocket message-type constants used by other services for broadcasting.
MSG_FEED_SEEDED = 'feed.seeded'
MSG_FEED_INGESTED = 'feed.ingested'
MSG_PROPOSAL_CREATED = 'proposal.created'
MSG_PROPOSAL_RESOLVED = 'proposal.resolved'
