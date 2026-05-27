from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import watchlist_service

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistAddBody(BaseModel):
    code: str
    name: str
    market: str = "SH"
    notes: str = ""


@router.get("")
async def get_watchlist():
    return await watchlist_service.get_watchlist()


@router.post("")
async def add_to_watchlist(body: WatchlistAddBody):
    return await watchlist_service.add_to_watchlist(body.code, body.name, body.market, body.notes)


@router.delete("/{code}")
async def remove_from_watchlist(code: str):
    return await watchlist_service.remove_from_watchlist(code)
