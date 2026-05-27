from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.core.database import get_connection

logger = logging.getLogger(__name__)

_refresh_lock = asyncio.Lock()

BEIJING_TZ = timezone(timedelta(hours=8))
SINA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
}

# Sina finance news categories
NEWS_LIDS = {
    "macro": "1687",       # 宏观经济
    "stock": "2512",       # A股聚焦
    "industry": "1689",    # 行业新闻
    "company": "1690",     # 公司新闻
}


async def _fetch_sina_news(lid: str, num: int = 100) -> list[dict]:
    """Fetch news from Sina finance JSON API with pagination (up to 3 pages)."""
    import random as _random

    all_items = []
    for page in range(1, 4):
        try:
            url = "https://feed.mix.sina.com.cn/api/roll/get"
            params = {
                "pageid": "155",
                "lid": lid,
                "num": num,
                "page": page,
                "r": str(_random.random()),
            }
            async with httpx.AsyncClient(timeout=15, headers=SINA_HEADERS) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            items = data.get("result", {}).get("data", []) or []
            if not items:
                break
            all_items.extend(items)
        except Exception as e:
            logger.error("fetch sina news lid=%s page=%d error: %s", lid, page, e)
            break

    results = []
    for item in all_items:
        ctime = int(item.get("ctime", 0))
        pub_time = datetime.fromtimestamp(ctime, tz=BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
        results.append({
            "source": "sina",
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "content": item.get("intro", ""),
            "published_at": pub_time,
        })

    conn = get_connection()
    for r in results:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO news_cache (source, title, url, content, published_at)
                   VALUES (?,?,?,?,?)""",
                (r["source"], r["title"], r["url"], r["content"], r["published_at"]),
            )
        except Exception as e:
            logger.error("sina insert error: %s", e)
    conn.commit()
    conn.close()

    return results


async def fetch_all_sina_news() -> int:
    """Fetch from all Sina categories. Returns total count."""
    total = 0
    for name, lid in NEWS_LIDS.items():
        items = await _fetch_sina_news(lid)
        total += len(items)
        logger.info("sina %s: %d items", name, len(items))
    return total


async def _fetch_eastmoney_news() -> list[dict]:
    """Fetch fast news from EastMoney with pagination (up to 5 pages)."""
    import random as _random
    import string as _string

    all_items = []
    for page in range(1, 6):
        try:
            url = "https://np-listapi.eastmoney.com/comm/web/getFastNews"
            trace = "".join(_random.choices(_string.ascii_letters + _string.digits, k=32))
            params = {
                "client": "web",
                "biz": "fastnews",
                "fastNewsType": "0",
                "pageIndex": page,
                "pageSize": 100,
                "req_trace": trace,
            }
            async with httpx.AsyncClient(timeout=15, headers=SINA_HEADERS) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            items = data.get("data", []) if isinstance(data.get("data"), list) else []
            if not items:
                break
            all_items.extend(items)
        except Exception as e:
            logger.warning("EastMoney news fetch page=%d error: %s", page, e)
            break

    results = []
    for item in all_items:
        title = item.get("title", "") or item.get("digest", "")
        if not title:
            continue
        pub_time = item.get("showTime", "") or item.get("date", "") or ""
        results.append({
            "source": "eastmoney",
            "title": title,
            "url": item.get("url", "") or item.get("wapUrl", ""),
            "content": item.get("digest", "") or item.get("summary", ""),
            "published_at": pub_time,
        })

    conn = get_connection()
    for r in results:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO news_cache (source, title, url, content, published_at) VALUES (?,?,?,?,?)",
                (r["source"], r["title"], r["url"], r["content"], r["published_at"]),
            )
        except Exception:
            pass
    conn.commit()
    conn.close()
    return results


async def _fetch_cls_news() -> list[dict]:
    """Fetch telegraph news from 财联社 (CLS) with pagination (up to 5 pages)."""
    all_items = []
    for page in range(1, 6):
        try:
            url = "https://www.cls.cn/nodeapi/telegraphList"
            params = {
                "app": "CailianpressWeb",
                "os": "web",
                "sv": "8.4.6",
                "page": page,
                "rn": 100,
            }
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.cls.cn/telegraph",
            }
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            items = data.get("data", {}).get("roll_data", []) or []
            if not items:
                break
            all_items.extend(items)
        except Exception as e:
            logger.warning("CLS news fetch page=%d error: %s", page, e)
            break

    results = []
    for item in all_items:
        title = item.get("title", "") or item.get("brief", "")
        if not title:
            continue
        ctime = item.get("ctime", 0)
        if ctime and str(ctime).isdigit():
            pub_time = datetime.fromtimestamp(int(ctime), tz=BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
        else:
            pub_time = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")

        results.append({
            "source": "cls",
            "title": title,
            "url": item.get("shareurl", "") or item.get("url", ""),
            "content": item.get("brief", "") or item.get("content", ""),
            "published_at": pub_time,
        })

    conn = get_connection()
    for r in results:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO news_cache (source, title, url, content, published_at) VALUES (?,?,?,?,?)",
                (r["source"], r["title"], r["url"], r["content"], r["published_at"]),
            )
        except Exception:
            pass
    conn.commit()
    conn.close()
    return results


async def get_all_news(limit: int = 50, offset: int = 0) -> list[dict]:
    """Get latest news from cache with pagination."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM news_cache ORDER BY published_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


async def refresh_news() -> dict:
    """Refresh all news sources sequentially to avoid SQLite concurrent write conflicts."""
    if _refresh_lock.locked():
        logger.info("News refresh already in progress, skipping")
        return {"sina": 0, "eastmoney": 0, "cls": 0, "total": 0, "skipped": True}

    async with _refresh_lock:
        sina_count = await fetch_all_sina_news()
        logger.info("Sina news: %d items", sina_count)

        em_items = await _fetch_eastmoney_news()
        logger.info("EastMoney news: %d items", len(em_items))

        cls_items = await _fetch_cls_news()
        logger.info("CLS news: %d items", len(cls_items))

        total = sina_count + len(em_items) + len(cls_items)

        # Cleanup news older than 3 days
        try:
            conn = get_connection()
            cutoff = (datetime.now(BEIJING_TZ) - timedelta(days=3)).strftime("%Y-%m-%d %H:%M")
            conn.execute("DELETE FROM news_cache WHERE published_at < ?", (cutoff,))
            conn.commit()
            conn.close()
        except Exception:
            pass

        return {"sina": sina_count, "eastmoney": len(em_items), "cls": len(cls_items), "total": total}


async def search_news_for_stock(keyword: str) -> list[dict]:
    """Search cached news by keyword using FTS5 full-text index."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT nc.* FROM news_cache nc
               JOIN news_fts fts ON nc.id = fts.rowid
               WHERE news_fts MATCH ?
               ORDER BY rank LIMIT 30""",
            (keyword,),
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [dict(r) for r in rows]


async def _ai_chat(prompt: str, max_tokens: int = 300) -> str:
    """Call DeepSeek API for a chat completion."""
    from app.core.config import settings

    api_key = settings.ai_api_key
    if not api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ai_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.ai_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error("AI chat error: %s", e)
        return ""


async def get_news_summary() -> dict:
    """Return cached AI-generated market news summary (generated in background)."""
    from pathlib import Path
    from app.core.config import settings

    cache_path = Path(__file__).resolve().parent.parent.parent / "storage" / "news_summary.txt"
    enabled_path = Path(__file__).resolve().parent.parent.parent / "storage" / "news_summary_enabled.txt"

    # Respect the enable/disable flag
    if enabled_path.exists():
        val = enabled_path.read_text(encoding="utf-8").strip()
        if val == "0":
            return {"summary": "", "enabled": False}

    if cache_path.exists():
        age = __import__("time").time() - cache_path.stat().st_mtime
        if age < 600:  # 10-minute TTL
            return {"summary": cache_path.read_text(encoding="utf-8"), "cached": True}

    return {"summary": "", "cached": False}


async def refresh_news_summary() -> dict:
    """Generate AI summary and cache to file. Called by APScheduler and manual refresh."""
    from pathlib import Path

    conn = get_connection()
    rows = conn.execute(
        "SELECT title, content, published_at FROM news_cache ORDER BY published_at DESC LIMIT 30"
    ).fetchall()
    conn.close()

    if not rows:
        return {"summary": "", "status": "no_news"}

    news_text = "\n".join(
        f"- [{r['published_at']}] {r['title']}: {r['content']}" for r in rows
    )
    prompt = f"""你是一位极其专业的金融市场行情分析师。请根据以下最新财经新闻，用中文写一份简洁的市场要闻摘要（7条要点，挑最重要的写，每条不超过20字，末尾用括号注明对于大A是利好利空还是中性，必须具体说明对哪些板块）。只返回要点，不要其他内容。

{news_text}"""

    summary = await _ai_chat(prompt, max_tokens=500)
    if not summary:
        return {"summary": "", "status": "no_api_key"}

    cache_path = Path(__file__).resolve().parent.parent.parent / "storage" / "news_summary.txt"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(summary, encoding="utf-8")

    _invalidate_news_summary_cache()
    return {"summary": summary, "status": "generated"}


def _invalidate_news_summary_cache():
    """Clear in-memory cache so next request reads the file."""
    pass  # file-based cache, no in-memory cache to clear


def get_news_summary_enabled() -> bool:
    from pathlib import Path
    p = Path(__file__).resolve().parent.parent.parent / "storage" / "news_summary_enabled.txt"
    if not p.exists():
        return True  # default enabled
    return p.read_text(encoding="utf-8").strip() != "0"


def set_news_summary_enabled(enabled: bool) -> None:
    from pathlib import Path
    p = Path(__file__).resolve().parent.parent.parent / "storage" / "news_summary_enabled.txt"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("1" if enabled else "0", encoding="utf-8")


async def get_stock_sentiment(code: str, name: str) -> dict:
    """Analyze sentiment for a stock based on recent related news."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT nc.title, nc.content, nc.published_at FROM news_cache nc
               JOIN news_fts fts ON nc.id = fts.rowid
               WHERE news_fts MATCH ?
               ORDER BY rank LIMIT 10""",
            (f"{code} OR {name}",),
        ).fetchall()
    except Exception:
        rows = (
            conn.execute(
                """SELECT title, content, published_at FROM news_cache
                   WHERE title LIKE ? OR content LIKE ?
                   ORDER BY published_at DESC LIMIT 10""",
                (f"%{code}%", f"%{code}%"),
            ).fetchall()
        )
    conn.close()

    if not rows:
        return {"sentiment": "neutral", "summary": "暂无该股相关新闻", "news": []}

    news_list = [dict(r) for r in rows]
    news_text = "\n".join(
        f"- [{r['published_at']}] {r['title']}" for r in news_list
    )

    prompt = f"""请根据以下与该股票相关的新闻，判断整体情绪是"利好"、"利空"还是"中性"，并用一句话（20字内）总结原因。返回格式: 情绪|总结

{news_text}"""

    result = await _ai_chat(prompt, max_tokens=100)
    sentiment = "neutral"
    summary = "暂无明确信号"
    if result:
        parts = result.split("|", 1)
        s = parts[0].strip()
        if "利好" in s:
            sentiment = "positive"
        elif "利空" in s:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        if len(parts) > 1:
            summary = parts[1].strip()

    return {
        "sentiment": sentiment,
        "summary": summary,
        "news": news_list,
    }
