from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from app.core.database import get_connection

logger = logging.getLogger(__name__)

VALID_TYPES = {"price", "indicator", "news", "pnl", "volume"}
VALID_OPS = {"gt", "lt", "gte", "lte", "cross_above", "cross_below", "pct_change"}


# ── CRUD ───────────────────────────────────────────────────────────────────

def create_rule(
    user_id: int, name: str, alert_type: str, code: str, market: str,
    condition_field: str, condition_op: str, condition_value: float,
    cooldown_minutes: int = 60, notify_channels: str = "",
) -> dict[str, Any]:
    if alert_type not in VALID_TYPES:
        return {"error": f"Invalid alert type: {alert_type}"}
    if condition_op not in VALID_OPS:
        return {"error": f"Invalid operator: {condition_op}"}

    conn = get_connection()
    conn.execute(
        """INSERT INTO alert_rules
           (user_id, name, alert_type, code, market, condition_field, condition_op,
            condition_value, cooldown_minutes, notify_channels)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (user_id, name, alert_type, code, market, condition_field, condition_op,
         condition_value, cooldown_minutes, notify_channels),
    )
    conn.commit()
    rid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": rid, "status": "created"}


def get_rules(user_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM alert_rules WHERE user_id=? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_rule(rule_id: int, user_id: int, **fields) -> dict[str, Any]:
    allowed = {"name", "alert_type", "code", "market", "condition_field", "condition_op",
               "condition_value", "enabled", "cooldown_minutes", "notify_channels"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return {"status": "no_changes"}

    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values())
    values.extend([rule_id, user_id])

    conn = get_connection()
    conn.execute(
        f"UPDATE alert_rules SET {set_clause}, updated_at=datetime('now','localtime') WHERE id=? AND user_id=?",
        values,
    )
    conn.commit()
    updated = conn.total_changes > 0
    conn.close()
    return {"status": "ok" if updated else "not_found"}


def delete_rule(rule_id: int, user_id: int) -> bool:
    conn = get_connection()
    conn.execute("DELETE FROM alert_rules WHERE id=? AND user_id=?", (rule_id, user_id))
    conn.commit()
    deleted = conn.total_changes > 0
    conn.close()
    return deleted


def get_alert_history(user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM alert_history WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Alert Checker ──────────────────────────────────────────────────────────

async def _get_quote(code: str) -> dict[str, Any]:
    """Get single quote, trying each market service."""
    from app.services import market_service, hk_market_service, us_market_service

    # Try A-share first
    try:
        quotes = await market_service.batch_quotes([code])
        if code in quotes:
            return quotes[code]
    except Exception:
        pass

    # Try HK
    try:
        q = await hk_market_service.get_hk_quote(code)
        if q and q.get("latest_price"):
            return q
    except Exception:
        pass

    # Try US
    try:
        q = await us_market_service.get_us_quote(code)
        if q and q.get("latest_price"):
            return q
    except Exception:
        pass

    return {}


def _check_condition(current: float, op: str, threshold: float, previous: float | None = None) -> bool:
    """Evaluate a single condition."""
    if op == "gt":
        return current > threshold
    elif op == "lt":
        return current < threshold
    elif op == "gte":
        return current >= threshold
    elif op == "lte":
        return current <= threshold
    elif op == "cross_above" and previous is not None:
        return previous <= threshold and current > threshold
    elif op == "cross_below" and previous is not None:
        return previous >= threshold and current < threshold
    elif op == "pct_change" and previous is not None and previous != 0:
        pct = (current - previous) / abs(previous) * 100
        return abs(pct) >= abs(threshold)
    return False


def _record_alert_history(rule: dict[str, Any], message: str, triggered_value: float):
    conn = get_connection()
    conn.execute(
        "INSERT INTO alert_history (rule_id, user_id, message, triggered_value) VALUES (?,?,?,?)",
        (rule["id"], rule["user_id"], message, triggered_value),
    )
    conn.execute(
        "UPDATE alert_rules SET last_triggered_at=datetime('now','localtime') WHERE id=?",
        (rule["id"],),
    )
    conn.commit()
    conn.close()


async def check_alerts() -> dict[str, Any]:
    """Check all enabled alert rules and fire notifications.

    Called periodically (every 60s) by the scheduler.
    """
    conn = get_connection()
    rules = conn.execute(
        "SELECT * FROM alert_rules WHERE enabled = 1",
    ).fetchall()
    conn.close()

    if not rules:
        return {"checked": 0, "triggered": 0}

    triggered = 0
    now = datetime.now()

    for rule in rules:
        r = dict(rule)
        code = r["code"]

        # Cooldown check
        if r["last_triggered_at"]:
            last = datetime.fromisoformat(r["last_triggered_at"])
            if (now - last).total_seconds() < r["cooldown_minutes"] * 60:
                continue

        # Price/indicator/volume alerts: need quote data
        if r["alert_type"] in ("price", "indicator", "volume"):
            if not code:
                continue
            quote = await _get_quote(code)
            if not quote:
                continue

            current = quote.get(r["condition_field"], 0)
            threshold = r["condition_value"]

            if not current:
                continue

            fired = _check_condition(current, r["condition_op"], threshold)
            if fired:
                msg = f"[{r['name']}] {code} {r['condition_field']} {r['condition_op']} {threshold}: 当前值 {current}"
                _record_alert_history(r, msg, current)
                triggered += 1

        # PnL alerts: check portfolio
        elif r["alert_type"] == "pnl":
            from app.services import portfolio_service
            try:
                summary = await portfolio_service.get_portfolio_summary(int(code)) if code else {}
                if summary:
                    pnl_pct = summary.get("total_pnl_pct", 0)
                    if _check_condition(pnl_pct, r["condition_op"], r["condition_value"]):
                        msg = f"[{r['name']}] 组合盈亏 {pnl_pct}% 触发 {r['condition_op']} {r['condition_value']}%"
                        _record_alert_history(r, msg, pnl_pct)
                        triggered += 1
            except Exception:
                pass

    # Send notifications for triggered alerts
    if triggered > 0:
        try:
            from app.services.notification_service import get_notification_service
            ns = get_notification_service()
            await ns.broadcast("交易告警", f"{triggered} 条告警触发")
        except Exception:
            pass

    return {"checked": len(rules), "triggered": triggered}


# ── Background worker ──────────────────────────────────────────────────────

_worker_task: asyncio.Task | None = None


async def _alert_loop(interval: int = 60):
    """Run alert checks every `interval` seconds."""
    while True:
        try:
            await check_alerts()
        except Exception as e:
            logger.error(f"Alert check error: {e}")
        await asyncio.sleep(interval)


def start_alert_worker(interval: int = 60):
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_alert_loop(interval))
        logger.info("Alert worker started (interval=%ds)", interval)


def stop_alert_worker():
    global _worker_task
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        logger.info("Alert worker stopped")
