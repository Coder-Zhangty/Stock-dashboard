from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from app.core.database import get_connection

logger = logging.getLogger(__name__)

VALID_DIRECTIONS = {"bullish", "bearish", "neutral"}


def record_prediction(
    user_id: int, code: str, name: str, market: str,
    direction: str, confidence: int, price_at_analysis: float,
    target_price: float = 0, stop_loss: float = 0, analysis_json: str = "",
) -> dict[str, Any]:
    """Store an AI analysis prediction for later backtesting."""
    if direction not in VALID_DIRECTIONS:
        return {"error": f"Invalid direction: {direction}"}
    if not (1 <= confidence <= 100):
        return {"error": "Confidence must be 1-100"}

    conn = get_connection()
    conn.execute(
        """INSERT INTO backtest_records
           (user_id, code, name, market, direction, confidence, price_at_analysis,
            target_price, stop_loss, analysis_json)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (user_id, code, name, market, direction, confidence, price_at_analysis,
         target_price, stop_loss, analysis_json),
    )
    conn.commit()
    rid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": rid, "status": "recorded"}


async def evaluate_predictions(user_id: int | None = None, min_age_days: int = 5) -> dict[str, Any]:
    """Evaluate un-checked predictions against current price data.

    Queries the market service for current prices and compares direction
    and price change vs prediction.
    """
    conn = get_connection()
    where = "WHERE outcome_checked = 0"
    params: tuple = ()
    if user_id is not None:
        where += " AND user_id = ?"
        params = (user_id,)

    # Only evaluate records older than min_age_days
    cutoff = (datetime.now() - timedelta(days=min_age_days)).strftime("%Y-%m-%d %H:%M:%S")
    where += " AND created_at < ?"
    params = (*params, cutoff)

    rows = conn.execute(
        f"SELECT * FROM backtest_records {where} ORDER BY created_at ASC LIMIT 200",
        params,
    ).fetchall()
    conn.close()

    if not rows:
        return {"evaluated": 0, "total_pending": 0, "results": []}

    # Collect unique codes and get current quotes
    codes = list({r["code"] for r in rows})
    from app.services import market_service

    try:
        quotes = await market_service.batch_quotes(codes)
    except Exception:
        logger.warning("Failed to fetch quotes for backtest evaluation")
        quotes = {}

    results = []
    correct = 0
    wrong = 0
    neutral_count = 0

    for row in rows:
        row_dict = dict(row)
        code = row["code"]
        entry_price = row["price_at_analysis"]
        predicted_dir = row["direction"]
        quote = quotes.get(code, {})

        current_price = quote.get("latest_price", 0)
        if current_price <= 0 or entry_price <= 0:
            continue

        pnl_pct = (current_price - entry_price) / entry_price * 100

        # Determine actual direction
        if pnl_pct > 1.0:
            actual_dir = "bullish"
        elif pnl_pct < -1.0:
            actual_dir = "bearish"
        else:
            actual_dir = "neutral"

        # Score
        if predicted_dir == "neutral":
            neutral_count += 1
        elif predicted_dir == actual_dir:
            correct += 1
        elif actual_dir == "neutral":
            neutral_count += 1  # borderline, count as neutral
        else:
            wrong += 1

        # Update record
        conn2 = get_connection()
        conn2.execute(
            """UPDATE backtest_records SET
               outcome_checked=1, outcome_direction=?, outcome_price=?,
               outcome_pnl_pct=?, outcome_checked_at=datetime('now','localtime')
               WHERE id=?""",
            (actual_dir, round(current_price, 2), round(pnl_pct, 2), row["id"]),
        )
        conn2.commit()
        conn2.close()

        results.append({
            **row_dict,
            "current_price": round(current_price, 2),
            "pnl_pct": round(pnl_pct, 2),
            "actual_direction": actual_dir,
            "is_correct": predicted_dir == actual_dir,
        })

    total = correct + wrong
    accuracy = (correct / total * 100) if total > 0 else 0

    return {
        "evaluated": len(results),
        "correct": correct,
        "wrong": wrong,
        "neutral": neutral_count,
        "accuracy": round(accuracy, 1),
        "total": total,
        "results": results,
    }


def get_backtest_summary(user_id: int | None = None) -> dict[str, Any]:
    """Get aggregate backtest statistics."""
    conn = get_connection()
    where = "WHERE outcome_checked = 1"
    params: tuple = ()
    if user_id is not None:
        where += " AND user_id = ?"
        params = (user_id,)

    # Overall direction accuracy
    stats = conn.execute(
        f"""SELECT
             COUNT(*) as total,
             SUM(CASE WHEN direction = outcome_direction THEN 1 ELSE 0 END) as correct,
             AVG(outcome_pnl_pct) as avg_pnl,
             AVG(confidence) as avg_confidence,
             SUM(CASE WHEN direction = 'bullish' THEN 1 ELSE 0 END) as bullish_count,
             SUM(CASE WHEN direction = 'bearish' THEN 1 ELSE 0 END) as bearish_count,
             SUM(CASE WHEN direction = 'neutral' THEN 1 ELSE 0 END) as neutral_count
         FROM backtest_records {where}""",
        params,
    ).fetchone()

    total = stats["total"] or 0
    accuracy = (stats["correct"] / total * 100) if total > 0 else 0

    # Accuracy by confidence level
    conf_rows = conn.execute(
        f"""SELECT
             CASE
               WHEN confidence >= 80 THEN '80-100'
               WHEN confidence >= 60 THEN '60-79'
               WHEN confidence >= 40 THEN '40-59'
               ELSE '1-39'
             END as conf_bucket,
             COUNT(*) as cnt,
             SUM(CASE WHEN direction = outcome_direction THEN 1 ELSE 0 END) as corr
         FROM backtest_records {where}
         GROUP BY conf_bucket ORDER BY conf_bucket DESC""",
        params,
    ).fetchall()

    calibration = [
        {"bucket": r["conf_bucket"], "total": r["cnt"],
         "correct": r["corr"],
         "accuracy": round(r["corr"] / r["cnt"] * 100, 1) if r["cnt"] > 0 else 0}
        for r in conf_rows
    ]

    # Accuracy by market
    mkt_rows = conn.execute(
        f"""SELECT market, COUNT(*) as cnt,
             SUM(CASE WHEN direction = outcome_direction THEN 1 ELSE 0 END) as corr,
             AVG(outcome_pnl_pct) as avg_pnl
         FROM backtest_records {where}
         GROUP BY market""",
        params,
    ).fetchall()

    by_market = [
        {"market": r["market"], "total": r["cnt"],
         "accuracy": round(r["corr"] / r["cnt"] * 100, 1) if r["cnt"] > 0 else 0,
         "avg_pnl": round(r["avg_pnl"] or 0, 2)}
        for r in mkt_rows
    ]

    conn.close()
    return {
        "total_predictions": total,
        "direction_accuracy": round(accuracy, 1),
        "avg_confidence": round(stats["avg_confidence"] or 0, 1),
        "avg_pnl_pct": round(stats["avg_pnl"] or 0, 2),
        "bullish_count": stats["bullish_count"] or 0,
        "bearish_count": stats["bearish_count"] or 0,
        "neutral_count": stats["neutral_count"] or 0,
        "confidence_calibration": calibration,
        "by_market": by_market,
    }


def get_pending_count() -> int:
    conn = get_connection()
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM backtest_records WHERE outcome_checked = 0",
    ).fetchone()
    conn.close()
    return row["cnt"] if row else 0
