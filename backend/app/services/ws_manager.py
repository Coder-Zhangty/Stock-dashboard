from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket

from app.services import market_service

logger = logging.getLogger(__name__)

SUBSCRIBE = "subscribe"
UNSUBSCRIBE = "unsubscribe"
QUOTE_UPDATE = "quote_update"
ERROR = "error"


class WSManager:
    """Manages WebSocket connections for real-time stock quotes.

    Clients subscribe to specific stock codes. Quotes are broadcast every 3 seconds
    (configurable) to all subscribed clients.
    """

    def __init__(self, poll_interval: float = 3.0):
        self.poll_interval = poll_interval
        self._connections: dict[str, WebSocket] = {}
        self._subscriptions: dict[str, set[str]] = {}  # client_id -> set of codes
        self._code_subscribers: dict[str, set[str]] = {}  # code -> set of client_ids
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[Any] | None = None
        self._running = False
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"ws_{self._counter}"

    async def connect(self, ws: WebSocket) -> str:
        await ws.accept()
        client_id = self._next_id()
        async with self._lock:
            self._connections[client_id] = ws
            self._subscriptions[client_id] = set()
        self._ensure_polling()
        logger.info("WS client connected: %s (total: %d)", client_id, len(self._connections))
        return client_id

    async def disconnect(self, client_id: str):
        async with self._lock:
            codes = self._subscriptions.pop(client_id, set())
            for code in codes:
                sub = self._code_subscribers.get(code)
                if sub:
                    sub.discard(client_id)
                    if not sub:
                        del self._code_subscribers[code]
            self._connections.pop(client_id, None)
        logger.info("WS client disconnected: %s (remaining: %d)", client_id, len(self._connections))

    async def subscribe(self, client_id: str, codes: list[str]):
        async with self._lock:
            current = self._subscriptions.get(client_id, set())
            current.update(codes)
            self._subscriptions[client_id] = current
            for code in codes:
                self._code_subscribers.setdefault(code, set()).add(client_id)
        logger.debug("Client %s subscribed to %d codes", client_id, len(codes))

    async def unsubscribe(self, client_id: str, codes: list[str]):
        async with self._lock:
            current = self._subscriptions.get(client_id, set())
            current.difference_update(codes)
            for code in codes:
                sub = self._code_subscribers.get(code)
                if sub:
                    sub.discard(client_id)
                    if not sub:
                        del self._code_subscribers[code]

    async def handle_message(self, client_id: str, data: dict[str, Any]):
        msg_type = data.get("type")
        codes = data.get("codes", [])
        if not isinstance(codes, list):
            return
        if msg_type == SUBSCRIBE and codes:
            await self.subscribe(client_id, codes)
        elif msg_type == UNSUBSCRIBE and codes:
            await self.unsubscribe(client_id, codes)

    def _ensure_polling(self):
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())

    async def _poll_loop(self):
        while self._running:
            try:
                await self._broadcast_quotes()
            except Exception as exc:
                logger.error("WS poll error: %s", exc)
            await asyncio.sleep(self.poll_interval)

    async def _broadcast_quotes(self):
        async with self._lock:
            if not self._code_subscribers:
                return
            all_codes = list(self._code_subscribers.keys())

        if not all_codes:
            return

        try:
            quotes = await market_service.batch_quotes(all_codes)
        except Exception as exc:
            logger.warning("WS batch quotes failed: %s", exc)
            return

        if not quotes:
            return

        payload = {"type": QUOTE_UPDATE, "timestamp": time.time(), "data": quotes}

        async with self._lock:
            # Build code -> clients map
            for code, quote in quotes.items():
                clients = self._code_subscribers.get(code, set())
                for cid in clients:
                    ws = self._connections.get(cid)
                    if ws is None:
                        continue
                    try:
                        await ws.send_json({**payload, "code": code, "quote": quote})
                    except Exception:
                        logger.debug("Failed to send to client %s, queuing disconnect", cid)

    async def shutdown(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        async with self._lock:
            for ws in self._connections.values():
                try:
                    await ws.close()
                except Exception:
                    pass
            self._connections.clear()
            self._subscriptions.clear()
            self._code_subscribers.clear()
        logger.info("WS manager shutdown")


ws_manager = WSManager()
