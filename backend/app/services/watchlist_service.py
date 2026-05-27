from __future__ import annotations

import logging

from app.core.database import get_connection

logger = logging.getLogger(__name__)


async def get_watchlist() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM watchlist ORDER BY added_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


async def add_to_watchlist(code: str, name: str, market: str = "SH", notes: str = "") -> dict:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO watchlist (code, name, market, notes) VALUES (?,?,?,?)",
            (code, name, market, notes),
        )
        conn.commit()
        return {"ok": True, "code": code, "name": name}
    except Exception as e:
        logger.error("add watchlist error: %s", e)
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


async def remove_from_watchlist(code: str) -> dict:
    conn = get_connection()
    conn.execute("DELETE FROM watchlist WHERE code=?", (code,))
    conn.commit()
    conn.close()
    return {"ok": True, "code": code}
