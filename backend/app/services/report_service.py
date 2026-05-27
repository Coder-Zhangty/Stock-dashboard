from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

BEIJING_TZ = timezone(timedelta(hours=8))


def _now() -> str:
    return datetime.now(BEIJING_TZ).isoformat()


def _now_date() -> str:
    return datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")


async def _ai_chat(prompt: str, max_tokens: int = 800) -> str:
    api_key = settings.ai_api_key
    if not api_key:
        logger.warning("AI_API_KEY not configured, report generation skipped")
        return ""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ai_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.ai_model,
                    "messages": [
                        {"role": "system", "content": "你是一个专业的A股市场分析师，请用简洁专业的中文回复。"},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
            )
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("AI report generation failed: %s", exc)
        return ""


def _save_report(report_type: str, title: str, content: str) -> int:
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO reports (report_type, title, content, created_at)
           VALUES (?, ?, ?, ?)""",
        (report_type, title, content, _now()),
    )
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return report_id


def _get_recent_report(report_type: str) -> dict | None:
    conn = get_db()
    today = _now_date()
    row = conn.execute(
        """SELECT * FROM reports
           WHERE report_type = ? AND date(created_at) = ?
           ORDER BY created_at DESC LIMIT 1""",
        (report_type, today),
    ).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def _build_market_context() -> str:
    """Build a market context summary from cached data for the AI prompt."""
    conn = get_db()
    parts: list[str] = []

    # Major indices from cached snapshots
    rows = conn.execute(
        """SELECT name, latest_price, change_pct FROM stock_list
           WHERE code IN ('000001', '399001', '399006', '000688')
           ORDER BY code"""
    ).fetchall()
    if rows:
        parts.append("主要指数：")
        for r in rows:
            parts.append(f"  {r['name']} 最新价{r['latest_price']:.2f} 涨跌幅{r['change_pct']:+.2f}%")

    # Market breadth from stock_list
    total = conn.execute("SELECT COUNT(*) as cnt FROM stock_list").fetchone()["cnt"]
    up = conn.execute("SELECT COUNT(*) as cnt FROM stock_list WHERE change_pct > 0").fetchone()["cnt"]
    down = conn.execute("SELECT COUNT(*) as cnt FROM stock_list WHERE change_pct < 0").fetchone()["cnt"]
    flat = total - up - down
    parts.append(f"\n涨跌统计：总计{total}只 上涨{up}只 下跌{down}只 平盘{flat}只")

    # Top gainers (top 5)
    gainers = conn.execute(
        "SELECT name, code, change_pct FROM stock_list WHERE change_pct > 0 ORDER BY change_pct DESC LIMIT 5"
    ).fetchall()
    if gainers:
        parts.append("\n涨幅前5：")
        for r in gainers:
            parts.append(f"  {r['name']}({r['code']}) +{r['change_pct']:.2f}%")

    # Top losers (top 5)
    losers = conn.execute(
        "SELECT name, code, change_pct FROM stock_list WHERE change_pct < 0 ORDER BY change_pct ASC LIMIT 5"
    ).fetchall()
    if losers:
        parts.append("\n跌幅前5：")
        for r in losers:
            parts.append(f"  {r['name']}({r['code']}) {r['change_pct']:.2f}%")

    # Recent news summary (latest 10)
    news_rows = conn.execute(
        "SELECT title FROM news_cache ORDER BY published_at DESC LIMIT 10"
    ).fetchall()
    if news_rows:
        parts.append("\n最新财经快讯：")
        for r in news_rows:
            parts.append(f"  - {r['title']}")

    conn.close()
    return "\n".join(parts)


async def generate_daily_report() -> dict:
    """Generate a daily market analysis report after market close."""
    today = _now_date()
    existing = _get_recent_report("daily")
    if existing:
        return {"status": "skipped", "reason": "Report already generated today", "report": existing}

    market_context = _build_market_context()
    if not market_context:
        return {"status": "skipped", "reason": "No market data available"}

    prompt = f"""请根据以下A股市场数据，生成一份今日收盘分析报告。报告应包含：

1. 市场概况（主要指数表现分析）
2. 涨跌分布分析
3. 热点板块和个股点评
4. 资金面简析
5. 明日关注要点

格式要求：Markdown格式，简洁专业，不提供买卖建议。

以下是市场数据：

{market_context}"""

    report_content = await _ai_chat(prompt, max_tokens=800)
    if not report_content:
        return {"status": "skipped", "reason": "AI generation failed"}

    title = f"A股收盘分析报告 — {today}"
    report_id = _save_report("daily", title, report_content)
    logger.info("Daily report generated: id=%s", report_id)

    return {"status": "generated", "report_id": report_id, "title": title, "content": report_content}


async def generate_pre_market_brief() -> dict:
    """Generate a pre-market brief before market open."""
    today = _now_date()
    existing = _get_recent_report("pre_market")
    if existing:
        return {"status": "skipped", "reason": "Brief already generated today"}

    market_context = _build_market_context()

    prompt = f"""请根据以下信息，生成今日盘前简报。内容包括：

1. 隔夜重要财经新闻摘要（3-5条）
2. 今日关注要点（重要经济数据、政策动态等）
3. 操作提醒（新股申购、停复牌等）

格式要求：Markdown格式，简洁明了。

以下是参考数据：

{market_context}"""

    report_content = await _ai_chat(prompt, max_tokens=500)
    if not report_content:
        return {"status": "skipped", "reason": "AI generation failed"}

    title = f"盘前简报 — {today}"
    report_id = _save_report("pre_market", title, report_content)
    logger.info("Pre-market brief generated: id=%s", report_id)

    return {"status": "generated", "report_id": report_id, "title": title, "content": report_content}


async def generate_weekly_report() -> dict:
    """Generate a weekly market summary report (Friday after close)."""
    today = _now_date()
    existing = _get_recent_report("weekly")
    if existing:
        return {"status": "skipped", "reason": "Weekly report already generated today"}

    market_context = _build_market_context()

    prompt = f"""请根据以下市场数据，生成本周A股市场周度总结报告。报告应包含：

1. 本周市场总体表现回顾
2. 主要指数周度走势分析
3. 行业板块轮动分析
4. 资金面周度变化
5. 下周市场展望与关注点

格式要求：Markdown格式，深入分析但保持简洁。

以下是参考数据：

{market_context}"""

    report_content = await _ai_chat(prompt, max_tokens=1000)
    if not report_content:
        return {"status": "skipped", "reason": "AI generation failed"}

    title = f"周度市场总结 — {today}"
    report_id = _save_report("weekly", title, report_content)
    logger.info("Weekly report generated: id=%s", report_id)

    return {"status": "generated", "report_id": report_id, "title": title, "content": report_content}


def get_latest_report(report_type: str) -> dict | None:
    """Get the latest report of a given type."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM reports WHERE report_type = ? ORDER BY created_at DESC LIMIT 1",
        (report_type,),
    ).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def list_reports(report_type: str | None = None, limit: int = 20) -> list[dict]:
    """List recent reports, optionally filtered by type."""
    conn = get_db()
    if report_type:
        rows = conn.execute(
            "SELECT * FROM reports WHERE report_type = ? ORDER BY created_at DESC LIMIT ?",
            (report_type, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM reports ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
