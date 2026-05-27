from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import ws_manager, SUBSCRIBE, UNSUBSCRIBE, ERROR

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/api/ws/quotes")
async def ws_quotes(ws: WebSocket):
    client_id = await ws_manager.connect(ws)

    # Send initial confirmation
    await ws.send_json({"type": "connected", "client_id": client_id})

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data: dict = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": ERROR, "message": "Invalid JSON"})
                continue
            await ws_manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WS error for client %s: %s", client_id, exc)
    finally:
        await ws_manager.disconnect(client_id)
