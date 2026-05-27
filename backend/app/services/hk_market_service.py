from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── In-memory TTL cache ──
_cache: dict[str, tuple[float, Any]] = {}


def _get_cached(key: str, ttl: float) -> Any | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    stored_at, value = entry
    if time.time() - stored_at > ttl:
        del _cache[key]
        return None
    return value


def _set_cache(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)

HK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://gu.qq.com/",
}

HK_INDICES = {
    "HSI": "恒生指数",
    "HSCEI": "国企指数",
    "HSCCI": "红筹指数",
    "HSTECH": "恒生科技",
}

POPULAR_HK = [
    ("00700", "腾讯控股"), ("09988", "阿里巴巴-SW"), ("09999", "网易-S"),
    ("01810", "小米集团-W"), ("00941", "中国移动"), ("09618", "京东集团-SW"),
    ("01299", "友邦保险"), ("02318", "中国平安"), ("03968", "招商银行"),
    ("00388", "香港交易所"), ("00005", "汇丰控股"), ("00175", "吉利汽车"),
    ("02269", "药明生物"), ("02020", "安踏体育"), ("01024", "快手-W"),
    ("09888", "百度集团-SW"), ("03690", "美团-W"), ("02007", "碧桂园服务"),
    ("00981", "中芯国际"), ("01347", "华虹半导体"),
]


async def get_hk_quote(code: str) -> dict[str, Any] | None:
    """Fetch real-time quote for a single HK stock from Tencent."""
    symbol = f"hk{code}"
    url = f"http://qt.gtimg.cn/q={symbol}"
    try:
        async with httpx.AsyncClient(timeout=10, headers=HK_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
    except Exception as e:
        logger.warning("HK quote fetch failed for %s: %s", code, e)
        return None

    m = re.search(r'"([^"]*)"', text)
    if not m:
        return None
    parts = m.group(1).split("~")
    if len(parts) < 50:
        return None

    try:
        price = float(parts[3]) if parts[3] else 0
        prev = float(parts[4]) if parts[4] else 0
        change = price - prev
        pct = (change / prev * 100) if prev > 0 else 0
        return {
            "code": code,
            "name": parts[1],
            "latest_price": price,
            "prev_close": prev,
            "open": float(parts[5]) if parts[5] else 0,
            "high": float(parts[33]) if len(parts) > 33 and parts[33] else 0,
            "low": float(parts[34]) if len(parts) > 34 and parts[34] else 0,
            "volume": float(parts[6]) if parts[6] else 0,
            "amount": float(parts[37]) if len(parts) > 37 and parts[37] else 0,
            "change_pct": round(pct, 2),
            "change_amount": round(change, 2),
            "turnover": 0,
            "market": "HK",
            "currency": "HKD",
            "pe": float(parts[39]) if len(parts) > 39 and parts[39] else 0,
            "pb": float(parts[46]) if len(parts) > 46 and parts[46] else 0,
            "market_cap": float(parts[45]) if len(parts) > 45 and parts[45] else 0,
            "high_52w": float(parts[47]) if len(parts) > 47 and parts[47] else 0,
            "low_52w": float(parts[48]) if len(parts) > 48 and parts[48] else 0,
            "amplitude": float(parts[43]) if len(parts) > 43 and parts[43] else 0,
        }
    except (ValueError, IndexError) as e:
        logger.debug("HK quote parse error for %s: %s", code, e)
        return None


async def batch_hk_quotes(codes: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch quotes for multiple HK stocks."""
    if not codes:
        return {}
    symbols = [f"hk{c}" for c in codes]
    url = f"http://qt.gtimg.cn/q={','.join(symbols)}"
    try:
        async with httpx.AsyncClient(timeout=10, headers=HK_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
    except Exception as e:
        logger.warning("HK batch quotes failed: %s", e)
        return {}

    results: dict[str, dict[str, Any]] = {}
    for line in text.strip().split("\n"):
        if not line.strip():
            continue
        # Response format: v_hk00700="100~腾讯控股~00700~..."
        m = re.search(r'v_hk(\d+)="', line)
        if not m:
            continue
        code = m.group(1)
        quote = await _parse_single_hk_line(code, line)
        if quote:
            results[code] = quote
    return results


async def _parse_single_hk_line(code: str, text: str) -> dict[str, Any] | None:
    m = re.search(r'"([^"]*)"', text)
    if not m:
        return None
    parts = m.group(1).split("~")
    if len(parts) < 50:
        return None
    try:
        price = float(parts[3]) if parts[3] else 0
        prev = float(parts[4]) if parts[4] else 0
        change = price - prev
        pct = (change / prev * 100) if prev > 0 else 0
        return {
            "code": code,
            "name": parts[1],
            "latest_price": round(price, 2),
            "prev_close": round(prev, 2),
            "open": float(parts[5]) if parts[5] else 0,
            "high": float(parts[33]) if len(parts) > 33 and parts[33] else 0,
            "low": float(parts[34]) if len(parts) > 34 and parts[34] else 0,
            "volume": float(parts[6]) if parts[6] else 0,
            "amount": float(parts[37]) if len(parts) > 37 and parts[37] else 0,
            "change_pct": round(pct, 2),
            "change_amount": round(change, 2),
            "turnover": 0,
            "market": "HK",
            "currency": "HKD",
            "pe": float(parts[39]) if len(parts) > 39 and parts[39] else 0,
            "pb": float(parts[46]) if len(parts) > 46 and parts[46] else 0,
            "market_cap": float(parts[45]) if len(parts) > 45 and parts[45] else 0,
            "high_52w": float(parts[47]) if len(parts) > 47 and parts[47] else 0,
            "low_52w": float(parts[48]) if len(parts) > 48 and parts[48] else 0,
            "amplitude": float(parts[43]) if len(parts) > 43 and parts[43] else 0,
        }
    except (ValueError, IndexError):
        return None


async def get_hk_indices() -> list[dict[str, Any]]:
    """Fetch HK major indices. Uses Tencent hkHSI, hkHSCEI, etc. format."""
    codes = list(HK_INDICES.keys())
    url = f"http://qt.gtimg.cn/q={','.join(f'hk{c}' for c in codes)}"
    results: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=10, headers=HK_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
        for line in text.strip().split("\n"):
            if not line.strip():
                continue
            for key in HK_INDICES:
                if f"hk{key}" in line:
                    m = re.search(r'"([^"]*)"', line)
                    if not m:
                        continue
                    parts = m.group(1).split("~")
                    if len(parts) < 4:
                        continue
                    price = float(parts[3]) if parts[3] else 0
                    prev = float(parts[4]) if parts[4] else 0
                    pct = (price - prev) / prev * 100 if prev else 0
                    results.append({
                        "code": key,
                        "name": HK_INDICES[key],
                        "latest_price": round(price, 2),
                        "change_pct": round(pct, 2),
                        "change_amount": round(price - prev, 2),
                    })
                    break
    except Exception as e:
        logger.warning("HK indices failed: %s", e)
    return results


async def get_hk_popular() -> list[dict[str, Any]]:
    """Get quotes for popular HK stocks."""
    codes = [c for c, _ in POPULAR_HK]
    quotes = await batch_hk_quotes(codes)
    results: list[dict[str, Any]] = []
    for code, name in POPULAR_HK:
        if code in quotes:
            results.append(quotes[code])
        else:
            results.append({"code": code, "name": name, "latest_price": 0, "change_pct": 0, "market": "HK"})
    return results


async def get_hk_kline(code: str, period: str = "daily", count: int = 120) -> list[dict[str, Any]]:
    """Fetch HK stock K-line data from Tencent (cached 5min)."""
    cache_key = f"hk_kline:{code}:{period}:{count}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    period_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    ktype = period_map.get(period, "day")
    url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=hk{code},{ktype},,,{count},qfq"
    try:
        async with httpx.AsyncClient(timeout=15, headers=HK_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("HK kline fetch failed for %s: %s", code, e)
        return []

    try:
        stock_key = f"hk{code}"
        kline_data = data.get("data", {}).get(stock_key, {})
        key = f"qfq{ktype}" if f"qfq{ktype}" in kline_data else ktype
        rows = kline_data.get(key, [])
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    for row in rows:
        if len(row) < 6:
            continue
        try:
            results.append({
                "trade_date": str(row[0]),
                "open": float(row[1]) if row[1] else 0,
                "close": float(row[2]) if row[2] else 0,
                "high": float(row[3]) if row[3] else 0,
                "low": float(row[4]) if row[4] else 0,
                "volume": float(row[5]) if row[5] else 0,
                "amount": 0,
            })
        except (ValueError, IndexError):
            continue
    _set_cache(cache_key, results)
    return results


# ── EastMoney dynamic stock list fetch (like A-share) ──

HK_EM_SECTIONS = [
    ("m:128+t:3", "HK"),  # 港股主板
    ("m:128+t:4", "HK"),  # 港股创业板
    ("m:128+t:1", "HK"),  # 港股ETF/基金
    ("m:128+t:2", "HK"),  # 港股权证
]


async def _fetch_eastmoney_hk_stocks() -> list[dict[str, Any]]:
    """Fetch full HK stock list (code+name) from EastMoney. Prices come later via Tencent."""
    import asyncio as _asyncio
    stocks: list[dict[str, Any]] = []
    page_size = 500
    seen: set[str] = set()

    em_headers = {**HK_HEADERS, "Referer": "https://quote.eastmoney.com/"}
    async with httpx.AsyncClient(timeout=30, headers=em_headers) as client:
        for section, _market in HK_EM_SECTIONS:
            page = 1
            while True:
                try:
                    resp = await client.get(
                        "http://push2.eastmoney.com/api/qt/clist/get",
                        params={
                            "pn": page, "pz": page_size, "po": 0, "np": 1,
                            "fltt": 2, "invt": 2, "fid": "f12",
                            "fs": section, "fields": "f12,f14",
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except Exception as e:
                    logger.warning("EastMoney HK error (section=%s page=%s): %s", section, page, e)
                    break

                if not data or not data.get("data"):
                    break
                items = data["data"].get("diff") or []
                if not items:
                    break
                for item in items:
                    code = str(item.get("f12", "")).strip()
                    name = (item.get("f14", "") or "").strip()
                    if code and name and code not in seen:
                        seen.add(code)
                        stocks.append({"code": code, "name": name, "market": "HK"})

                total = data["data"].get("total", 0)
                if page * page_size >= total:
                    break
                page += 1
                await _asyncio.sleep(0.15)

    return stocks


async def refresh_hk_stock_list() -> int:
    """Fetch all HK stocks from EastMoney (primary) or seed fallback, cache to DB."""
    from app.core.database import get_connection

    stocks: list[dict[str, Any]] = []

    # Try EastMoney API first
    try:
        logger.info("Fetching HK stock list from EastMoney...")
        stocks = await _fetch_eastmoney_hk_stocks()
        logger.info("EastMoney HK returned %s stocks", len(stocks))
    except Exception as e:
        logger.warning("EastMoney HK fetch failed: %s", e)

    # Fallback to seed data
    if len(stocks) < 100:
        logger.info("EastMoney returned %s stocks (<100), using seed fallback", len(stocks))
        from app.services.hk_stock_seed import HK_STOCK_SEED
        stocks = [{"code": c, "name": n, "market": "HK"} for c, n in HK_STOCK_SEED]
        logger.info("HK seed fallback: %s stocks", len(stocks))

    if len(stocks) < 50:
        logger.error("HK stock list too small (%s), aborting refresh", len(stocks))
        return 0

    # Deduplicate by code
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for s in stocks:
        if s["code"] not in seen:
            seen.add(s["code"])
            unique.append(s)

    conn = get_connection()
    conn.execute("DELETE FROM stock_list_hk")
    for s in unique:
        conn.execute(
            "INSERT INTO stock_list_hk (code, name, market) VALUES (?, ?, ?)",
            (s["code"], s["name"], s["market"]),
        )
    conn.commit()
    conn.close()
    logger.info("HK stock list replaced: %s stocks (%s unique)", len(stocks), len(unique))
    return len(unique)


async def _refresh_hk_prices(codes: list[str]) -> None:
    """Background: fetch fresh HK prices and persist to stock_list_hk."""
    try:
        quotes = await batch_hk_quotes(codes)
    except Exception:
        return
    if not quotes:
        return
    from datetime import datetime
    from app.core.database import get_connection

    conn = get_connection()
    now = datetime.now().isoformat()
    for code, q in quotes.items():
        conn.execute(
            """UPDATE stock_list_hk SET
               latest_price=?, change_pct=?, change_amount=?, volume=?, amount=?,
               turnover=?, open=?, high=?, low=?, prev_close=?, snapshot_at=?
               WHERE code=?""",
            (q.get("latest_price", 0), q.get("change_pct", 0), q.get("change_amount", 0),
             q.get("volume", 0), q.get("amount", 0), q.get("turnover", 0),
             q.get("open", 0), q.get("high", 0), q.get("low", 0), q.get("prev_close", 0),
             now, code),
        )
    conn.commit()
    conn.close()


SORT_COLUMNS_HK = {
    "code": "code", "latest_price": "latest_price", "change_pct": "change_pct",
    "change_amount": "change_amount", "volume": "volume", "amount": "amount",
    "turnover": "turnover", "open": "open", "high": "high", "low": "low",
}


async def get_hk_spot_list(
    page: int = 1, page_size: int = 100,
    sort_by: str = "", sort_order: str = "desc",
    filters: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Fetch paginated HK spot quotes from local stock_list_hk cache."""
    import asyncio as _asyncio
    from app.core.database import get_connection

    conn = get_connection()
    conditions: list[str] = []
    params: list[Any] = []
    if filters:
        if "price_min" in filters:
            conditions.append("latest_price >= ?"); params.append(filters["price_min"])
        if "price_max" in filters:
            conditions.append("latest_price <= ?"); params.append(filters["price_max"])
        if "change_min" in filters:
            conditions.append("change_pct >= ?"); params.append(filters["change_min"])
        if "change_max" in filters:
            conditions.append("change_pct <= ?"); params.append(filters["change_max"])
        if "volume_min" in filters:
            conditions.append("volume >= ?"); params.append(filters["volume_min"])

    where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    total = conn.execute(f"SELECT COUNT(*) as cnt FROM stock_list_hk{where_clause}", params).fetchone()["cnt"]

    sort_col = SORT_COLUMNS_HK.get(sort_by, "code")
    sort_dir = "DESC" if (sort_by and sort_order == "desc") else "ASC"
    offset = (page - 1) * page_size

    rows = conn.execute(
        f"SELECT code, name, market, latest_price, prev_close, change_pct, change_amount, "
        f"open, high, low, volume, amount, turnover FROM stock_list_hk{where_clause} "
        f"ORDER BY {sort_col} {sort_dir}, code ASC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    ).fetchall()
    conn.close()

    results = [{k: row[k] for k in row.keys()} for row in rows]
    codes = [r["code"] for r in results]

    if codes:
        all_zero = all((r.get("latest_price") or 0) == 0 for r in results)
        if all_zero:
            try:
                quotes = await batch_hk_quotes(codes)
                for r in results:
                    if r["code"] in quotes:
                        q = quotes[r["code"]]
                        for f in ("latest_price", "prev_close", "change_pct", "change_amount",
                                  "open", "high", "low", "volume", "amount", "turnover"):
                            if f in q:
                                r[f] = q[f]
                _asyncio.create_task(_persist_hk_quotes(quotes))
            except Exception:
                pass
        else:
            _asyncio.create_task(_refresh_hk_prices(codes))

    return {"total": total, "page": page, "page_size": page_size, "data": results}


async def _persist_hk_quotes(quotes: dict[str, dict[str, Any]]) -> None:
    """Write fresh HK quotes to DB."""
    from datetime import datetime
    from app.core.database import get_connection

    conn = get_connection()
    now = datetime.now().isoformat()
    for code, q in quotes.items():
        conn.execute(
            """UPDATE stock_list_hk SET
               latest_price=?, change_pct=?, change_amount=?, volume=?, amount=?,
               turnover=?, open=?, high=?, low=?, prev_close=?, snapshot_at=?
               WHERE code=?""",
            (q.get("latest_price", 0), q.get("change_pct", 0), q.get("change_amount", 0),
             q.get("volume", 0), q.get("amount", 0), q.get("turnover", 0),
             q.get("open", 0), q.get("high", 0), q.get("low", 0), q.get("prev_close", 0),
             now, code),
        )
    conn.commit()
    conn.close()
