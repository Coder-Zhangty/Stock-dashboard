from __future__ import annotations

import logging
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

US_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

US_INDICES = {
    "^DJI": "道琼斯",
    "^IXIC": "纳斯达克",
    "^GSPC": "标普500",
}

POPULAR_US = [
    ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("GOOGL", "Alphabet"),
    ("AMZN", "Amazon"), ("NVDA", "NVIDIA"), ("META", "Meta"),
    ("TSLA", "Tesla"), ("BRK.B", "Berkshire Hathaway"), ("JPM", "JPMorgan"),
    ("V", "Visa"), ("JNJ", "Johnson & Johnson"), ("WMT", "Walmart"),
    ("MA", "Mastercard"), ("PG", "Procter & Gamble"), ("UNH", "UnitedHealth"),
    ("HD", "Home Depot"), ("BAC", "Bank of America"), ("DIS", "Disney"),
    ("NFLX", "Netflix"), ("ADBE", "Adobe"),
]


async def _yfinance_quote(symbol: str) -> dict[str, Any] | None:
    """Fetch a single US stock quote via Yahoo Finance v8 API."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": "1d", "interval": "1m"}
    try:
        async with httpx.AsyncClient(timeout=15, headers=US_HEADERS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("Yahoo Finance quote failed for %s: %s", symbol, e)
        return None

    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("chartPreviousClose", meta.get("previousClose", 0))
        change = price - prev if price and prev else 0
        pct = (change / prev * 100) if prev else 0

        return {
            "code": symbol,
            "name": meta.get("shortName", meta.get("symbol", symbol)),
            "latest_price": round(price, 2),
            "prev_close": round(prev, 2),
            "open": round(meta.get("regularMarketOpen", 0), 2),
            "high": round(meta.get("regularMarketDayHigh", 0), 2),
            "low": round(meta.get("regularMarketDayLow", 0), 2),
            "volume": meta.get("regularMarketVolume", 0),
            "amount": 0,
            "change_pct": round(pct, 2),
            "change_amount": round(change, 2),
            "turnover": 0,
            "market": "US",
            "currency": meta.get("currency", "USD"),
            "market_cap": meta.get("marketCap", 0),
            "pe": meta.get("trailingPE", 0),
            "high_52w": meta.get("fiftyTwoWeekHigh", 0),
            "low_52w": meta.get("fiftyTwoWeekLow", 0),
        }
    except (KeyError, IndexError, TypeError) as e:
        logger.debug("Yahoo parse error for %s: %s", symbol, e)
        return None


async def batch_us_quotes(symbols: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch quotes for multiple US stocks in parallel (limited concurrency)."""
    if not symbols:
        return {}
    import asyncio as _asyncio
    sem = _asyncio.Semaphore(5)  # max 5 concurrent

    async def _fetch_one(sym: str):
        async with sem:
            return sym, await _yfinance_quote(sym)

    tasks = [_fetch_one(s) for s in symbols]
    done = await _asyncio.gather(*tasks, return_exceptions=True)
    results: dict[str, dict[str, Any]] = {}
    for item in done:
        if isinstance(item, Exception):
            continue
        sym, quote = item
        if quote:
            results[sym] = quote
    return results


async def get_us_indices() -> list[dict[str, Any]]:
    """Fetch US major indices in parallel."""
    import asyncio as _asyncio

    async def _fetch_idx(code: str, name: str):
        quote = await _yfinance_quote(code)
        if quote:
            quote["name"] = name
            quote["code"] = code
            return quote
        return {"code": code, "name": name, "latest_price": 0, "change_pct": 0, "change_amount": 0}

    tasks = [_fetch_idx(code, name) for code, name in US_INDICES.items()]
    results = await _asyncio.gather(*tasks, return_exceptions=True)
    return [r if not isinstance(r, Exception) else {"code": "", "name": "", "latest_price": 0, "change_pct": 0} for r in results]


async def get_us_popular() -> list[dict[str, Any]]:
    """Get quotes for popular US stocks."""
    symbols = [s for s, _ in POPULAR_US]
    quotes = await batch_us_quotes(symbols)
    results: list[dict[str, Any]] = []
    for symbol, name in POPULAR_US:
        if symbol in quotes:
            results.append(quotes[symbol])
        else:
            results.append({
                "code": symbol, "name": name, "latest_price": 0,
                "change_pct": 0, "market": "US",
            })
    return results


async def get_us_kline(symbol: str, period: str = "daily", count: int = 120) -> list[dict[str, Any]]:
    """Fetch US stock K-line data from Yahoo Finance (cached 5min)."""
    cache_key = f"us_kline:{symbol}:{period}:{count}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    interval_map = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    interval = interval_map.get(period, "1d")

    # Map count to approximate range
    if period == "daily":
        range_str = "6mo" if count <= 130 else "1y"
    elif period == "weekly":
        range_str = "2y"
    else:
        range_str = "5y"

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": range_str, "interval": interval}
    try:
        async with httpx.AsyncClient(timeout=15, headers=US_HEADERS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("US kline fetch failed for %s: %s", symbol, e)
        return []

    try:
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        quotes = result["indicators"]["quote"][0]
        opens = quotes.get("open", [])
        highs = quotes.get("high", [])
        lows = quotes.get("low", [])
        closes = quotes.get("close", [])
        volumes = quotes.get("volume", [])
    except (KeyError, IndexError, TypeError) as e:
        logger.debug("US kline parse error for %s: %s", symbol, e)
        return []

    from datetime import datetime, timezone

    results: list[dict[str, Any]] = []
    for i, ts in enumerate(timestamps):
        try:
            results.append({
                "trade_date": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                "open": round(opens[i], 2) if opens[i] is not None else 0,
                "close": round(closes[i], 2) if closes[i] is not None else 0,
                "high": round(highs[i], 2) if highs[i] is not None else 0,
                "low": round(lows[i], 2) if lows[i] is not None else 0,
                "volume": volumes[i] or 0,
                "amount": 0,
            })
        except (IndexError, TypeError, ValueError):
            continue
    results = results[-count:] if len(results) > count else results
    _set_cache(cache_key, results)
    return results


# ── EastMoney dynamic stock list fetch (like A-share) ──

US_EM_SECTIONS = [
    ("m:105", "US"),  # NASDAQ
    ("m:106", "US"),  # NYSE
    ("m:107", "US"),  # AMEX
]


async def _fetch_eastmoney_us_stocks() -> list[dict[str, Any]]:
    """Fetch full US stock list (code+name) from EastMoney. Prices come later via Yahoo."""
    import asyncio as _asyncio
    stocks: list[dict[str, Any]] = []
    page_size = 500
    seen: set[str] = set()

    em_headers = {**US_HEADERS, "Referer": "https://quote.eastmoney.com/"}
    async with httpx.AsyncClient(timeout=30, headers=em_headers) as client:
        for section, _market in US_EM_SECTIONS:
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
                    logger.warning("EastMoney US error (section=%s page=%s): %s", section, page, e)
                    break

                if not data or not data.get("data"):
                    break
                items = data["data"].get("diff") or []
                if not items:
                    break
                for item in items:
                    # On push2.eastmoney.com: f12=ticker, f14=name
                    ticker = str(item.get("f12", "")).strip()
                    name = (item.get("f14", "") or "").strip()
                    if ticker and name and ticker not in seen:
                        seen.add(ticker)
                        stocks.append({"code": ticker, "name": name, "market": "US"})

                total = data["data"].get("total", 0)
                if page * page_size >= total:
                    break
                page += 1
                await _asyncio.sleep(0.15)

    return stocks


async def refresh_us_stock_list() -> int:
    """Fetch all US stocks from EastMoney (primary) or seed fallback, cache to DB."""
    from app.core.database import get_connection

    stocks: list[dict[str, Any]] = []

    # Try EastMoney API first
    try:
        logger.info("Fetching US stock list from EastMoney...")
        stocks = await _fetch_eastmoney_us_stocks()
        logger.info("EastMoney US returned %s stocks", len(stocks))
    except Exception as e:
        logger.warning("EastMoney US fetch failed: %s", e)

    # Fallback to seed data
    if len(stocks) < 100:
        logger.info("EastMoney returned %s stocks (<100), using seed fallback", len(stocks))
        from app.services.us_stock_seed import US_STOCK_SEED
        stocks = [{"code": c, "name": n, "market": "US"} for c, n in US_STOCK_SEED]
        logger.info("US seed fallback: %s stocks", len(stocks))

    if len(stocks) < 50:
        logger.error("US stock list too small (%s), aborting refresh", len(stocks))
        return 0

    # Deduplicate by code
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for s in stocks:
        if s["code"] not in seen:
            seen.add(s["code"])
            unique.append(s)

    conn = get_connection()
    conn.execute("DELETE FROM stock_list_us")
    for s in unique:
        conn.execute(
            "INSERT INTO stock_list_us (code, name, market) VALUES (?, ?, ?)",
            (s["code"], s["name"], s["market"]),
        )
    conn.commit()
    conn.close()
    logger.info("US stock list replaced: %s stocks (%s unique)", len(stocks), len(unique))
    return len(unique)

POPULAR_US = [
    ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("GOOGL", "Alphabet"),
    ("AMZN", "Amazon"), ("NVDA", "NVIDIA"), ("META", "Meta"),
    ("TSLA", "Tesla"), ("BRK.B", "Berkshire Hathaway"), ("JPM", "JPMorgan"),
    ("V", "Visa"), ("JNJ", "Johnson & Johnson"), ("WMT", "Walmart"),
    ("MA", "Mastercard"), ("PG", "Procter & Gamble"), ("UNH", "UnitedHealth"),
    ("HD", "Home Depot"), ("BAC", "Bank of America"), ("DIS", "Disney"),
    ("NFLX", "Netflix"), ("ADBE", "Adobe"),
]


async def _refresh_us_prices(codes: list[str]) -> None:
    """Background: fetch fresh US prices and persist to stock_list_us."""
    try:
        quotes = await batch_us_quotes(codes)
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
            """UPDATE stock_list_us SET
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


SORT_COLUMNS_US = {
    "code": "code", "latest_price": "latest_price", "change_pct": "change_pct",
    "change_amount": "change_amount", "volume": "volume", "amount": "amount",
    "turnover": "turnover", "open": "open", "high": "high", "low": "low",
}


async def get_us_spot_list(
    page: int = 1, page_size: int = 100,
    sort_by: str = "", sort_order: str = "desc",
    filters: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Fetch paginated US spot quotes from local stock_list_us cache."""
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
    total = conn.execute(f"SELECT COUNT(*) as cnt FROM stock_list_us{where_clause}", params).fetchone()["cnt"]

    sort_col = SORT_COLUMNS_US.get(sort_by, "code")
    sort_dir = "DESC" if (sort_by and sort_order == "desc") else "ASC"
    offset = (page - 1) * page_size

    rows = conn.execute(
        f"SELECT code, name, market, latest_price, prev_close, change_pct, change_amount, "
        f"open, high, low, volume, amount, turnover FROM stock_list_us{where_clause} "
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
                quotes = await batch_us_quotes(codes)
                for r in results:
                    if r["code"] in quotes:
                        q = quotes[r["code"]]
                        for f in ("latest_price", "prev_close", "change_pct", "change_amount",
                                  "open", "high", "low", "volume", "amount", "turnover"):
                            if f in q:
                                r[f] = q[f]
                _asyncio.create_task(_persist_us_quotes(quotes))
            except Exception:
                pass
        else:
            _asyncio.create_task(_refresh_us_prices(codes))

    return {"total": total, "page": page, "page_size": page_size, "data": results}


async def _persist_us_quotes(quotes: dict[str, dict[str, Any]]) -> None:
    """Write fresh US quotes to DB."""
    from datetime import datetime
    from app.core.database import get_connection

    conn = get_connection()
    now = datetime.now().isoformat()
    for code, q in quotes.items():
        conn.execute(
            """UPDATE stock_list_us SET
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
