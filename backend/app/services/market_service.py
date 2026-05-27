from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime
from typing import Any

import httpx

from app.core.database import get_connection

logger = logging.getLogger(__name__)

# ── In-memory TTL cache ──
_cache: dict[str, tuple[float, Any]] = {}

def _get_cached(key: str, ttl: float) -> Any | None:
    """Return cached value if key exists and hasn't expired."""
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

def _invalidate_cache(prefix: str = "") -> None:
    """Remove entries whose key starts with given prefix."""
    if not prefix:
        _cache.clear()
        return
    for k in list(_cache.keys()):
        if k.startswith(prefix):
            del _cache[k]

SINA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
}

SINA_KL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/stock/",
}

EASTMONEY_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://quote.eastmoney.com/",
}

TENCENT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://gu.qq.com/",
}


def _sina_symbol(code: str) -> str:
    """Convert code like 600519 or 000001 to Sina symbol sh600519 / sz000001."""
    c = str(code).strip()
    if c.startswith(("6", "5", "9")):
        return f"sh{c}"
    return f"sz{c}"


def _tencent_symbol(code: str) -> str:
    c = str(code).strip()
    if c.startswith(("6", "5", "9")):
        return f"sh{c}"
    return f"sz{c}"


def _parse_sina_quote(line: str) -> dict[str, Any] | None:
    """Parse a Sina quote line like: var hq_str_sh600519="name,open,prev_close,..."."""
    m = re.search(r'"([^"]*)"', line)
    if not m:
        return None
    parts = m.group(1).split(",")
    if len(parts) < 32:
        return None

    def _f(idx: int) -> float:
        try:
            return float(parts[idx]) if parts[idx] else 0
        except (ValueError, IndexError):
            return 0

    # Parse 5-level bid/ask: parts 10-19 are bid1_price,bid1_vol,...,bid5_vol
    # parts 20-29 are ask1_price,ask1_vol,...,ask5_vol
    bids = []
    asks = []
    if len(parts) >= 30:
        for i in range(5):
            bp = _f(10 + i * 2)
            bv = _f(11 + i * 2)
            if bp > 0:
                bids.append({"price": round(bp, 2), "volume": int(bv)})
            ap = _f(20 + i * 2)
            av = _f(21 + i * 2)
            if ap > 0:
                asks.append({"price": round(ap, 2), "volume": int(av)})

    return {
        "name": parts[0],
        "open": _f(1),
        "prev_close": _f(2),
        "latest_price": _f(3),
        "high": _f(4),
        "low": _f(5),
        "volume": _f(8),
        "amount": _f(9),
        "bids": bids,
        "asks": asks,
        "date": parts[30] if len(parts) > 30 else "",
    }


async def _sina_batch_quotes(codes: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch quotes for multiple stocks at once."""
    if not codes:
        return {}
    symbols = [_sina_symbol(c) for c in codes]
    url = f"https://hq.sinajs.cn/list={','.join(symbols)}"
    async with httpx.AsyncClient(timeout=20, headers=SINA_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    results = {}
    for i, line in enumerate(text.strip().splitlines()):
        data = _parse_sina_quote(line)
        if data and i < len(codes):
            code = codes[i]
            prev = data["prev_close"]
            price = data["latest_price"]
            change = price - prev if prev else 0
            pct = (change / prev * 100) if prev else 0
            results[code] = {
                "code": code,
                "name": data["name"],
                "market": "SH" if _sina_symbol(code).startswith("sh") else "SZ",
                "latest_price": round(price, 2),
                "prev_close": round(prev, 2),
                "change_pct": round(pct, 2),
                "change_amount": round(change, 2),
                "open": data["open"],
                "high": data["high"],
                "low": data["low"],
                "volume": data["volume"],
                "amount": data["amount"],
                "turnover": 0,
                "turnover_rate": 0,
                "volume_ratio": 0,
                "pe": 0,
                "pe_ttm": 0,
                "pb": 0,
                "amplitude": 0,
                "total_market_cap": 0,
                "circulating_market_cap": 0,
                "bids": data.get("bids", []),
                "asks": data.get("asks", []),
            }
    return results


async def _tencent_batch_quotes(codes: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch quotes for multiple stocks from Tencent (rich data source with PE/PB/market cap etc.)."""
    if not codes:
        return {}
    symbols = [_tencent_symbol(c) for c in codes]
    url = f"http://qt.gtimg.cn/q={','.join(symbols)}"
    try:
        async with httpx.AsyncClient(timeout=20, headers=TENCENT_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
    except Exception as e:
        logger.warning("Tencent batch quotes HTTP error: %s", e)
        return {}

    results: dict[str, dict[str, Any]] = {}

    def _f(idx: int) -> float:
        try:
            return float(parts[idx]) if idx < len(parts) and parts[idx] else 0
        except (ValueError, IndexError):
            return 0

    lines = text.strip().splitlines()
    for i, line in enumerate(lines):
        m = re.search(r'"([^"]*)"', line)
        if not m:
            continue
        parts = m.group(1).split("~")
        if len(parts) < 50:
            continue
        try:
            code = parts[2].strip()
            if code not in codes:
                if i < len(codes):
                    code = codes[i]
                else:
                    continue
            name = parts[1]
            price = _f(3)
            prev = _f(4)
            change = price - prev if prev else 0
            pct = (change / prev * 100) if prev else 0
            results[code] = {
                "code": code,
                "name": name,
                "market": "SH" if code.startswith(("6", "5", "9")) else "SZ",
                "latest_price": round(price, 2),
                "prev_close": round(prev, 2),
                "change_pct": round(pct, 2),
                "change_amount": round(change, 2),
                "open": _f(5),
                "high": _f(33),
                "low": _f(34),
                "volume": _f(6),
                "amount": _f(37),
                "turnover": _f(38),
                "turnover_rate": _f(38),
                "volume_ratio": _f(49),
                "pe": _f(39),
                "pe_ttm": _f(52),
                "pb": _f(46),
                "amplitude": _f(43),
                "total_market_cap": _f(45),
                "circulating_market_cap": _f(44),
            }
        except (ValueError, IndexError) as e:
            logger.debug("Tencent parse error for line %d: %s", i, e)
            continue
    return results


async def batch_quotes(codes: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch quotes for a list of stock codes. Tries Tencent first (rich data), falls back to Sina.
    Results cached for 3 seconds (real-time quote TTL)."""
    cache_key = f"batch_quotes:{','.join(sorted(codes))}"
    cached = _get_cached(cache_key, 3.0)
    if cached is not None:
        return cached

    # Try Tencent first (richer data: PE/PB/market cap/amplitude etc.)
    try:
        results = await _tencent_batch_quotes(codes)
        if results:
            _set_cache(cache_key, results)
            return results
    except Exception as e:
        logger.warning("Tencent batch quotes failed: %s", e)

    # Fallback to Sina
    try:
        results = await _sina_batch_quotes(codes)
        if results:
            _set_cache(cache_key, results)
            return results
    except Exception as e:
        logger.warning("Sina batch quotes failed: %s", e)

    logger.error("All quote sources failed for %d codes", len(codes))
    return {}


async def get_stock_quote(code: str, market: str = "SH") -> dict[str, Any]:
    # Check stock_list cache first (5s TTL)
    conn = get_connection()
    row = conn.execute(
        "SELECT code, name, market, latest_price, prev_close, change_pct, change_amount, "
        "open, high, low, volume, amount, turnover, snapshot_at FROM stock_list WHERE code=?",
        (code,)
    ).fetchone()
    conn.close()

    if row and row["snapshot_at"]:
        try:
            snap_time = datetime.fromisoformat(row["snapshot_at"])
            age = (datetime.now() - snap_time).total_seconds()
            if age < 5:
                result = _row_to_quote(row)
                result["bids"] = []; result["asks"] = []
                return result
        except (ValueError, TypeError):
            pass

    # Cache miss or stale — fetch from Tencent/Sina (batch_quotes prefers Tencent for rich data)
    try:
        results = await batch_quotes([code])
        if code in results:
            q = results[code]
            await _persist_quotes_to_db({code: q})
            return q
        if row:
            result = _row_to_quote(row)
            result["bids"] = []; result["asks"] = []
            return result
        return {"error": f"Stock {code} not found"}
    except Exception as e:
        logger.error("fetch quote error for %s: %s", code, e)
        if row:
            result = _row_to_quote(row)
            result["bids"] = []; result["asks"] = []
            return result
        return {"error": str(e)}


# ─── Multi-source stock list (Sina + East Money in parallel) ─────────────

SINA_LIST_URL = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"

EM_SECTIONS = [
    ("m:0+t:6", "SH"),    # 沪市主板
    ("m:0+t:80", "SZ"),   # 深市主板
    ("m:1+t:2", "SZ"),    # 创业板
    ("m:1+t:23", "SH"),   # 科创板
]


async def fetch_sectors(sector_type: str = "industry") -> list[dict[str, Any]]:
    """Fetch industry or concept sector data via AKShare (THS data source). Cached 5 min."""
    cache_key = f"sectors:{sector_type}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    import asyncio

    def _fetch():
        import akshare as ak

        # THS concept summary doesn't have performance data, use industry for both
        if sector_type == "concept":
            df = ak.stock_board_concept_summary_ths()
            if df is not None and not df.empty:
                results: list[dict[str, Any]] = []
                for _, row in df.iterrows():
                    results.append({
                        "code": str(row.get("概念名称", "")),
                        "name": str(row.get("概念名称", "")),
                        "change_pct": 0,
                        "change_amount": 0,
                        "lead_stock": str(row.get("龙头股", "") or ""),
                        "lead_name": str(row.get("龙头股", "") or ""),
                        "up_count": 0,
                        "down_count": 0,
                    })
                return results

        # Industry: full performance data
        df = ak.stock_board_industry_summary_ths()
        if df is None or df.empty:
            return []

        results: list[dict[str, Any]] = []
        for _, row in df.iterrows():
            results.append({
                "code": str(row.get("板块", "")),
                "name": str(row.get("板块", "")),
                "change_pct": round(float(row.get("涨跌幅", 0) or 0), 2),
                "change_amount": 0,
                "lead_stock": str(row.get("领涨股", "") or ""),
                "lead_name": str(row.get("领涨股", "") or ""),
                "up_count": int(row.get("上涨家数", 0) or 0),
                "down_count": int(row.get("下跌家数", 0) or 0),
            })
        return results

    try:
        results = await asyncio.to_thread(_fetch)
        logger.info("Sectors (%s): %d items via THS", sector_type, len(results))
        _set_cache(cache_key, results)
        return results
    except Exception as e:
        logger.error("THS sectors failed: %s", e)
        return []


async def _fetch_sina_stocks() -> list[dict[str, Any]]:
    """Fetch full A-share list from Sina Market Center."""
    import asyncio as _asyncio
    stocks = []
    page_size = 100
    async with httpx.AsyncClient(timeout=30, headers=SINA_HEADERS) as client:
        for page in range(1, 60):
            try:
                resp = await client.get(
                    SINA_LIST_URL,
                    params={"page": page, "num": page_size, "sort": "symbol", "asc": 1, "node": "hs_a"},
                )
                if resp.status_code == 456:
                    logger.info("Sina rate-limited at page %s (got %s so far)", page, len(stocks))
                    break
                resp.raise_for_status()
                data = resp.json()
                if not isinstance(data, list) or not data:
                    break
                for item in data:
                    code = str(item.get("code", "")).strip()
                    name = (item.get("name", "") or "").strip()
                    if code and name:
                        mkt = "SH" if code.startswith(("6", "5", "9")) else "SZ"
                        stocks.append({"code": code, "name": name, "market": mkt})
                if len(data) < page_size:
                    break
                await _asyncio.sleep(0.3)
            except Exception as e:
                logger.warning("Sina stock list error at page %s: %s", page, e)
                break
    return stocks


async def _fetch_eastmoney_stocks() -> list[dict[str, Any]]:
    """Fetch full A-share list from East Money (multiple sections)."""
    import asyncio as _asyncio
    stocks = []
    page_size = 500

    async with httpx.AsyncClient(timeout=30, headers=SINA_HEADERS) as client:
        for section, default_market in EM_SECTIONS:
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
                    logger.warning("EastMoney error (section=%s page=%s): %s", section, page, e)
                    break

                if not data or not data.get("data"):
                    break
                items = data["data"].get("diff") or []
                if not items:
                    break
                for item in items:
                    code = str(item.get("f12", "")).strip()
                    name = (item.get("f14", "") or "").strip()
                    if code and name:
                        stocks.append({"code": code, "name": name, "market": default_market})

                total = data["data"].get("total", 0)
                if page * page_size >= total:
                    break
                page += 1
                await _asyncio.sleep(0.15)

    return stocks


async def init_stock_list() -> int:
    """Fetch all A-share stocks from Sina + East Money in parallel, merge, cache to DB."""
    import asyncio as _asyncio

    logger.info("Initializing stock list (multi-source)...")
    conn = get_connection()

    # Fire both sources in parallel
    sina_task = _asyncio.create_task(_fetch_sina_stocks())
    em_task = _asyncio.create_task(_fetch_eastmoney_stocks())

    sina_stocks = await sina_task
    logger.info("Sina returned %s stocks", len(sina_stocks))

    em_stocks = await em_task
    logger.info("EastMoney returned %s stocks", len(em_stocks))

    # Merge: deduplicate by code, preferring Sina's name
    merged = {}
    for s in em_stocks:
        merged[s["code"]] = s
    for s in sina_stocks:
        merged[s["code"]] = s  # Sina overwrites (usually better names)

    stocks = list(merged.values())
    logger.info("Merged total: %s unique stocks", len(stocks))

    # Write to DB (don't wipe unless we have good data)
    if len(stocks) >= 2000:
        conn.execute("DELETE FROM stock_list")
        for s in stocks:
            conn.execute(
                "INSERT INTO stock_list (code, name, market) VALUES (?, ?, ?)",
                (s["code"], s["name"], s["market"]),
            )
        conn.commit()
        logger.info("Stock list replaced: %s stocks", len(stocks))
    elif len(stocks) > 0:
        # Merge with existing
        for s in stocks:
            conn.execute(
                "INSERT OR IGNORE INTO stock_list (code, name, market) VALUES (?, ?, ?)",
                (s["code"], s["name"], s["market"]),
            )
        conn.commit()
        logger.info("Stock list merged: %s new stocks", len(stocks))
    else:
        logger.warning("Both sources failed, keeping existing data")

    conn.close()
    return len(stocks)


def _get_stock_count() -> int:
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) as cnt FROM stock_list").fetchone()
    conn.close()
    return row["cnt"] if row else 0


async def search_stock(keyword: str) -> list[dict[str, Any]]:
    """Search stocks by code or name from the full stock list. Cached 5 min."""
    cache_key = f"search:{keyword.lower()}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    conn = get_connection()
    kw = f"%{keyword.upper()}%"
    rows = conn.execute(
        "SELECT code, name, market FROM stock_list WHERE code LIKE ? OR name LIKE ? LIMIT 30",
        (kw, kw),
    ).fetchall()
    conn.close()
    result = [{"code": r["code"], "name": r["name"], "market": r["market"]} for r in rows]
    _set_cache(cache_key, result)
    return result


SORT_COLUMNS = {
    "code": "code",
    "name": "name",
    "latest_price": "latest_price",
    "change_pct": "change_pct",
    "volume": "volume",
    "amount": "amount",
    "turnover": "turnover",
}


async def _refresh_page_prices(codes: list[str]) -> None:
    """Background: fetch fresh prices for a set of stocks and persist to stock_list."""
    try:
        quotes = await batch_quotes(codes)
    except Exception:
        return
    if not quotes:
        return
    conn = get_connection()
    now = datetime.now().isoformat()
    for code, q in quotes.items():
        conn.execute(
            """UPDATE stock_list SET
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


def _row_to_quote(r: dict[str, Any]) -> dict[str, Any]:
    keys = r.keys()
    def _val(key: str, default: Any = 0) -> Any:
        if key in keys:
            v = r[key]
            return v if v is not None else default
        return default
    return {
        "code": _val("code", ""), "name": _val("name", ""), "market": _val("market", ""),
        "latest_price": _val("latest_price"),
        "prev_close": _val("prev_close"),
        "change_pct": _val("change_pct"),
        "change_amount": _val("change_amount"),
        "open": _val("open"),
        "high": _val("high"),
        "low": _val("low"),
        "volume": _val("volume"),
        "amount": _val("amount"),
        "turnover": _val("turnover"),
        "turnover_rate": _val("turnover_rate"),
        "volume_ratio": _val("volume_ratio"),
        "pe": _val("pe"),
        "pe_ttm": _val("pe_ttm"),
        "pb": _val("pb"),
        "amplitude": _val("amplitude"),
        "total_market_cap": _val("total_market_cap"),
        "circulating_market_cap": _val("circulating_market_cap"),
    }


async def get_spot_list(
    page: int = 1, page_size: int = 100,
    sort_by: str = "", sort_order: str = "desc",
    filters: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Fetch paginated spot quotes from local stock_list cache. Background-refreshes prices."""
    conn = get_connection()

    conditions: list[str] = []
    params: list[Any] = []
    if filters:
        if "price_min" in filters:
            conditions.append("latest_price >= ?")
            params.append(filters["price_min"])
        if "price_max" in filters:
            conditions.append("latest_price <= ?")
            params.append(filters["price_max"])
        if "change_min" in filters:
            conditions.append("change_pct >= ?")
            params.append(filters["change_min"])
        if "change_max" in filters:
            conditions.append("change_pct <= ?")
            params.append(filters["change_max"])
        if "volume_min" in filters:
            conditions.append("volume >= ?")
            params.append(filters["volume_min"])

    where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    total = conn.execute(f"SELECT COUNT(*) as cnt FROM stock_list{where_clause}", params).fetchone()["cnt"]

    sort_col = SORT_COLUMNS.get(sort_by, "code")
    sort_dir = "DESC" if (sort_by and sort_order == "desc") else "ASC"
    offset = (page - 1) * page_size

    rows = conn.execute(
        f"SELECT code, name, market, latest_price, prev_close, change_pct, change_amount, "
        f"open, high, low, volume, amount, turnover FROM stock_list{where_clause} "
        f"ORDER BY {sort_col} {sort_dir}, code ASC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    ).fetchall()
    conn.close()

    results = [_row_to_quote(r) for r in rows]
    codes = [r["code"] for r in rows]

    if codes:
        all_zero = all((r["latest_price"] or 0) == 0 for r in rows)
        EXTRA_FIELDS = ("turnover_rate", "volume_ratio", "pe", "pe_ttm", "pb",
                        "amplitude", "total_market_cap", "circulating_market_cap")
        CORE_FIELDS = ("latest_price", "prev_close", "change_pct", "change_amount",
                       "open", "high", "low", "volume", "amount", "turnover")

        if all_zero:
            try:
                quotes = await batch_quotes(codes)
                for i, r in enumerate(results):
                    if r["code"] in quotes:
                        q = quotes[r["code"]]
                        for f in CORE_FIELDS + EXTRA_FIELDS:
                            if f in q:
                                results[i][f] = q[f]
                asyncio.create_task(_persist_quotes_to_db(quotes))
            except Exception:
                pass
        else:
            # Enrich from in-memory cache only (no DB write). Background refreshes prices.
            _enrich_from_cache(results, codes, CORE_FIELDS + EXTRA_FIELDS)
            asyncio.create_task(_refresh_page_prices(codes))

        # Apply extra-field filters in memory (not in stock_list)
        if filters:
            results = [r for r in results if _match_extra_filters(r, filters)]

    return {"total": total, "page": page, "page_size": page_size, "data": results}


def _enrich_from_cache(results: list[dict[str, Any]], codes: list[str], fields: tuple) -> None:
    """Merge fields from in-memory cache only. No HTTP, no DB write."""
    cache_key = f"batch_quotes:{','.join(sorted(codes))}"
    entry = _cache.get(cache_key)
    if entry is None:
        return
    stored_at, quotes = entry
    if time.time() - stored_at > 3.0:
        del _cache[cache_key]
        return
    for i, r in enumerate(results):
        if r["code"] in quotes:
            q = quotes[r["code"]]
            for f in fields:
                if f in q:
                    results[i][f] = q[f]


def _match_extra_filters(r: dict[str, Any], filters: dict[str, float]) -> bool:
    """Check in-memory filters for fields not in stock_list."""
    if "turnover_min" in filters and r.get("turnover_rate", 0) < filters["turnover_min"]:
        return False
    if "turnover_max" in filters and r.get("turnover_rate", 0) > filters["turnover_max"]:
        return False
    if "volume_ratio_min" in filters and r.get("volume_ratio", 0) < filters["volume_ratio_min"]:
        return False
    if "volume_ratio_max" in filters and r.get("volume_ratio", 0) > filters["volume_ratio_max"]:
        return False
    if "pe_min" in filters and r.get("pe", 0) < filters["pe_min"]:
        return False
    if "pe_max" in filters and r.get("pe", 0) > filters["pe_max"]:
        return False
    if "pb_min" in filters and r.get("pb", 0) < filters["pb_min"]:
        return False
    if "pb_max" in filters and r.get("pb", 0) > filters["pb_max"]:
        return False
    if "amplitude_min" in filters and r.get("amplitude", 0) < filters["amplitude_min"]:
        return False
    if "amplitude_max" in filters and r.get("amplitude", 0) > filters["amplitude_max"]:
        return False
    if "mcap_min" in filters and r.get("total_market_cap", 0) < filters["mcap_min"]:
        return False
    if "mcap_max" in filters and r.get("total_market_cap", 0) > filters["mcap_max"]:
        return False
    return True


async def _persist_quotes_to_db(quotes: dict) -> None:
    """Persist quotes to stock_list DB."""
    if not quotes:
        return
    conn = get_connection()
    now = datetime.now().isoformat()
    for code, q in quotes.items():
        conn.execute(
            """UPDATE stock_list SET
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


# ─── Intraday minute line ────────────────────────────────────────────────


async def get_minute_line(code: str) -> dict[str, Any]:
    """Fetch intraday minute data from Tencent. Cached 1 second for multi-user sharing."""
    cache_key = f"minute:{code}"
    cached = _get_cached(cache_key, 1.0)
    if cached is not None:
        return cached

    symbol = _sina_symbol(code)  # Tencent uses same sh/sz prefix format
    url = f"https://ifzq.gtimg.cn/appstock/app/minute/query?_var=min_data&code={symbol}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    # Response: min_data={...}
    prefix = "min_data="
    if not text.startswith(prefix):
        return {"data": [], "prev_close": 0, "code": code}

    try:
        import json
        data = json.loads(text[len(prefix):])
    except (json.JSONDecodeError, ValueError):
        return {"data": [], "prev_close": 0, "code": code}

    if data.get("code") != 0:
        return {"data": [], "prev_close": 0, "code": code}

    stock_data = data.get("data", {}).get(symbol, {})
    minute_info = stock_data.get("data", {})
    raw_bars = minute_info.get("data", [])
    date_str = minute_info.get("date", "")

    # Parse prev_close from qt array
    qt = stock_data.get("qt", {}).get(symbol, [])
    prev_close = float(qt[4]) if len(qt) > 4 and qt[4] else 0

    if not raw_bars:
        result = {"data": [], "prev_close": prev_close, "code": code, "date": _format_tencent_date(date_str)}
        _set_cache(cache_key, result)
        return result

    minutes = []
    cum_vol = 0
    cum_amt = 0
    for bar in raw_bars:
        parts = bar.split(" ")
        if len(parts) < 3:
            continue
        time_str = parts[0][:2] + ":" + parts[0][2:]  # "0930" → "09:30"
        price = float(parts[1])
        vol = float(parts[2])
        cum_vol += vol
        cum_amt += price * vol * 100
        avg_price = cum_amt / (cum_vol * 100) if cum_vol > 0 else price
        minutes.append({
            "time": time_str,
            "price": round(price, 2),
            "avg_price": round(avg_price, 2),
            "volume": vol,
        })

    result = {
        "data": minutes,
        "prev_close": prev_close,
        "code": code,
        "date": _format_tencent_date(date_str),
    }
    _set_cache(cache_key, result)
    return result


def _format_tencent_date(date_str: str) -> str:
    """Convert '20260522' → '2026-05-22'."""
    if len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str


# ─── K-line ──────────────────────────────────────────────────────────────


PERIOD_SCALE = {"daily": 240, "weekly": 1200, "monthly": 7200, "day": 240, "week": 1200, "month": 7200,
    "5min": 5, "15min": 15, "30min": 30, "60min": 60}
# 1min/120min not supported by Sina — falls through to EastMoney

EM_KLT_MAP = {"daily": 101, "day": 101, "weekly": 102, "week": 102, "monthly": 103, "month": 103,
    "5min": 5, "15min": 15, "30min": 30, "60min": 60}


async def _eastmoney_kline(code: str, period: str = "daily", count: int = 120) -> list[dict[str, Any]]:
    """Fetch K-line from EastMoney (fallback source)."""
    market_id = "1" if code.startswith(("6", "5", "9")) else "0"
    secid = f"{market_id}.{code}"
    klt = EM_KLT_MAP.get(period, 101)

    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": secid,
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        "klt": klt,
        "fqt": 1,
        "end": "20500101",
        "lmt": count * 2,
    }

    async with httpx.AsyncClient(timeout=20, headers=EASTMONEY_HEADERS) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    if not data or not data.get("data") or not data["data"].get("klines"):
        return []

    results: list[dict[str, Any]] = []
    for line in data["data"]["klines"]:
        parts = line.split(",")
        if len(parts) < 7:
            continue
        results.append({
            "day": parts[0],
            "open": parts[1],
            "close": parts[2],
            "high": parts[3],
            "low": parts[4],
            "volume": parts[5],
            "amount": parts[6],
            "amplitude": parts[7] if len(parts) > 7 else "",
            "change_pct": parts[8] if len(parts) > 8 else "",
            "change_amount": parts[9] if len(parts) > 9 else "",
            "turnover_rate": parts[10] if len(parts) > 10 else "",
        })

    return results[-count:] if len(results) > count else results


def _cache_kline_rows(conn, code: str, period: str, rows: list[dict[str, Any]]) -> None:
    """Insert K-line rows into DB cache."""
    for item in rows:
        turnover = item.get("turnover_rate", "")
        amplitude = item.get("amplitude", "")
        change_pct = item.get("change_pct", "")
        conn.execute(
            """INSERT OR IGNORE INTO daily_kline
               (code, trade_date, open, high, low, close, volume, amount, period, turnover_rate, amplitude, change_pct)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (code, item["day"], float(item["open"]), float(item["high"]),
             float(item["low"]), float(item["close"]), float(item["volume"]),
             float(item.get("amount", 0) or 0), period,
             float(turnover) if turnover and turnover != "-" else None,
             float(amplitude) if amplitude and amplitude != "-" else None,
             float(change_pct) if change_pct and change_pct != "-" else None),
        )
    conn.commit()


async def get_kline(code: str, period: str = "daily", count: int = 120) -> list[dict[str, Any]]:
    """Fetch K-line with multi-source fallback. Sina → EastMoney. Caches to local DB + memory (5min TTL)."""
    cache_key = f"kline:{code}:{period}:{count}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    conn = get_connection()

    cached = conn.execute(
        "SELECT * FROM daily_kline WHERE code=? AND period=? ORDER BY trade_date DESC LIMIT ?",
        (code, period, count),
    ).fetchall()

    if len(cached) >= count:
        conn.close()
        return [dict(r) for r in reversed(cached)]

    INTRA_DAY = {"5min", "15min", "30min", "60min"}
    fetched = False

    if period in INTRA_DAY:
        # Intraday: prefer EastMoney (handles turnover_rate, amount, etc.)
        try:
            em_rows = await _eastmoney_kline(code, period, count)
            if em_rows:
                _cache_kline_rows(conn, code, period, em_rows)
                fetched = True
                logger.info("EastMoney K-line succeeded for %s/%s", code, period)
        except Exception as e:
            logger.warning("EastMoney K-line failed for %s/%s: %s, trying Sina", code, period, e)

        if not fetched and period in PERIOD_SCALE:
            try:
                symbol = _sina_symbol(code)
                scale = PERIOD_SCALE[period]
                url = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
                params = {"symbol": symbol, "scale": scale, "ma": "no", "datalen": count * 2}
                async with httpx.AsyncClient(timeout=20, headers=SINA_KL_HEADERS) as client:
                    resp = await client.get(url, params=params)
                    resp.raise_for_status()
                    raw = resp.json()
                if isinstance(raw, list) and raw:
                    _cache_kline_rows(conn, code, period, raw[-count:])
                    fetched = True
            except Exception as e:
                logger.warning("Sina K-line also failed for %s/%s: %s", code, period, e)
    else:
        # Daily/weekly/monthly: prefer Sina
        if period in PERIOD_SCALE:
            try:
                symbol = _sina_symbol(code)
                scale = PERIOD_SCALE[period]
                url = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
                params = {"symbol": symbol, "scale": scale, "ma": "no", "datalen": count * 2}
                async with httpx.AsyncClient(timeout=20, headers=SINA_KL_HEADERS) as client:
                    resp = await client.get(url, params=params)
                    resp.raise_for_status()
                    raw = resp.json()
                if isinstance(raw, list) and raw:
                    _cache_kline_rows(conn, code, period, raw[-count:])
                    fetched = True
            except Exception as e:
                logger.warning("Sina K-line failed for %s/%s: %s, trying EastMoney", code, period, e)

        if not fetched:
            try:
                em_rows = await _eastmoney_kline(code, period, count)
                if em_rows:
                    _cache_kline_rows(conn, code, period, em_rows)
                    logger.info("EastMoney K-line fallback succeeded for %s/%s", code, period)
            except Exception as e:
                logger.error("EastMoney K-line also failed for %s/%s: %s", code, period, e)

    rows = conn.execute(
        "SELECT * FROM daily_kline WHERE code=? AND period=? ORDER BY trade_date DESC LIMIT ?",
        (code, period, count),
    ).fetchall()
    conn.close()
    result = [dict(r) for r in reversed(rows)]
    _set_cache(cache_key, result)
    return result


INDEX_CODES = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "000300": "沪深300",
    "000688": "科创50",
    "000016": "上证50",
    "000905": "中证500",
    "899050": "北证50",
}


def _index_tencent_symbol(code: str) -> str:
    """Convert index code to Tencent symbol: 000300→sh000300, 899050→bj899050."""
    if code.startswith("89"):
        return f"bj{code}"
    if code.startswith(("0", "6", "5", "9")):
        return f"sh{code}"
    return f"sz{code}"


async def _tencent_indices() -> list[dict[str, Any]]:
    """Fetch major A-share indices from Tencent."""
    symbols = [_index_tencent_symbol(c) for c in INDEX_CODES]
    url = f"http://qt.gtimg.cn/q={','.join(symbols)}"
    async with httpx.AsyncClient(timeout=10, headers=TENCENT_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    results: list[dict[str, Any]] = []
    for line in text.strip().splitlines():
        m = re.search(r'"([^"]*)"', line)
        if not m:
            continue
        parts = m.group(1).split("~")
        if len(parts) < 40:
            continue
        try:
            code = parts[2]
            name = INDEX_CODES.get(code, parts[1])
            price = float(parts[3]) if parts[3] else 0
            change = float(parts[31]) if parts[31] else 0
            pct = float(parts[32]) if parts[32] else 0
            results.append({
                "code": code,
                "name": name,
                "latest_price": round(price, 2),
                "change_amount": round(change, 2),
                "change_pct": round(pct, 2),
            })
        except (ValueError, IndexError):
            continue
    return results


async def _sina_indices() -> list[dict[str, Any]]:
    """Fetch major A-share indices from Sina (fallback source)."""
    sina_symbols = [
        "s_sh000001", "s_sz399001", "s_sz399006",
        "s_sh000300", "s_sh000688", "s_sh000016", "s_sh000905",
    ]
    url = f"https://hq.sinajs.cn/list={','.join(sina_symbols)}"
    async with httpx.AsyncClient(timeout=10, headers=SINA_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    results: list[dict[str, Any]] = []
    for line in text.strip().splitlines():
        var_match = re.search(r's_[shz]{2}(\d+)', line)
        if not var_match:
            continue
        code = var_match.group(1)
        m = re.search(r'"([^"]*)"', line)
        if not m:
            continue
        parts = m.group(1).split(",")
        if len(parts) < 4:
            continue
        try:
            name = INDEX_CODES.get(code, parts[0])
            price = float(parts[3]) if parts[3] else 0
            prev = float(parts[2]) if parts[2] else 0
            change = price - prev if prev else 0
            pct = (change / prev * 100) if prev else 0
            results.append({
                "code": code,
                "name": name,
                "latest_price": round(price, 2),
                "change_amount": round(change, 2),
                "change_pct": round(pct, 2),
            })
        except (ValueError, IndexError):
            continue
    return results


async def get_indices() -> list[dict[str, Any]]:
    """Fetch major A-share indices. Tencent → Sina fallback. Cached 30 seconds."""
    cached = _get_cached("indices", 30.0)
    if cached is not None:
        return cached

    try:
        results = await _tencent_indices()
        if results:
            _set_cache("indices", results)
            return results
    except Exception as e:
        logger.warning("Tencent indices failed: %s", e)

    try:
        results = await _sina_indices()
        if results:
            _set_cache("indices", results)
            return results
    except Exception as e:
        logger.error("Sina indices also failed: %s", e)

    return []


async def get_fund_flow(code: str, days: int = 30) -> list[dict[str, Any]]:
    """Fetch fund flow data from EastMoney for a single stock. Cached 5 min."""
    cache_key = f"fundflow:{code}:{days}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    import asyncio as _asyncio

    market_id = "1" if code.startswith(("6", "5", "9")) else "0"
    secid = f"{market_id}.{code}"

    url = "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
    params = {
        "secid": secid,
        "fields1": "f1,f2,f3,f4",
        "fields2": "f51,f52,f54,f56,f58,f60",
        "lmt": days,
        "klt": "101",
    }

    def _fetch():
        with httpx.Client(timeout=15, headers=EASTMONEY_HEADERS) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            return r.json()

    try:
        data = await _asyncio.to_thread(_fetch)
    except Exception as e:
        logger.warning("Fund flow fetch error for %s: %s", code, e)
        return []

    if not data or not data.get("data") or not data["data"].get("klines"):
        return []

    results: list[dict[str, Any]] = []
    for line in data["data"]["klines"]:
        parts = line.split(",")
        if len(parts) < 6:
            continue
        try:
            main_net = round(float(parts[1]) / 1e4, 2) if parts[1] != "-" else 0  # 万元
            super_large = round(float(parts[2]) / 1e4, 2) if parts[2] != "-" else 0
            large = round(float(parts[3]) / 1e4, 2) if parts[3] != "-" else 0
            medium = round(float(parts[4]) / 1e4, 2) if parts[4] != "-" else 0
            small = round(float(parts[5]) / 1e4, 2) if parts[5] != "-" else 0
            results.append({
                "date": parts[0],
                "main_net": main_net,
                "super_large": super_large,
                "large": large,
                "medium": medium,
                "small": small,
            })
        except (ValueError, IndexError):
            continue

    _set_cache(cache_key, results)
    return results


async def get_market_breadth() -> dict[str, Any]:
    """Count rising/falling/flat stocks from local snapshot. Cached 30 seconds."""
    cached = _get_cached("market_breadth", 30.0)
    if cached is not None:
        return cached

    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) as cnt FROM stock_list").fetchone()["cnt"]
    up = conn.execute("SELECT COUNT(*) as cnt FROM stock_list WHERE change_pct > 0").fetchone()["cnt"]
    down = conn.execute("SELECT COUNT(*) as cnt FROM stock_list WHERE change_pct < 0").fetchone()["cnt"]
    flat = conn.execute("SELECT COUNT(*) as cnt FROM stock_list WHERE change_pct = 0 OR change_pct IS NULL").fetchone()["cnt"]
    conn.close()

    result = {"up": up, "down": down, "flat": flat, "total": total}
    _set_cache("market_breadth", result)
    return result


async def get_market_turnover() -> dict[str, Any]:
    """Total turnover for Shanghai + Shenzhen. Cached 60 seconds."""
    cached = _get_cached("market_turnover", 60.0)
    if cached is not None:
        return cached

    conn = get_connection()
    sh = conn.execute(
        "SELECT SUM(amount) as total FROM stock_list WHERE code LIKE '6%' OR code LIKE '5%' OR code LIKE '9%'"
    ).fetchone()["total"] or 0
    sz = conn.execute(
        "SELECT SUM(amount) as total FROM stock_list WHERE code LIKE '0%' OR code LIKE '2%' OR code LIKE '3%'"
    ).fetchone()["total"] or 0
    conn.close()

    result = {"sh_total": round(sh, 2), "sz_total": round(sz, 2), "total": round(sh + sz, 2)}
    _set_cache("market_turnover", result)
    return result


async def get_northbound_flow() -> dict[str, Any]:
    """北向资金 (north-bound capital flow) from EastMoney. Cached 60 seconds."""
    cached = _get_cached("northbound_flow", 60.0)
    if cached is not None:
        return cached

    import asyncio as _asyncio

    secids = {"sh": "1.000001", "sz": "1.000002"}
    result: dict[str, Any] = {"sh_net": 0, "sz_net": 0, "total_net": 0, "date": ""}

    def _fetch_one(secid: str) -> dict:
        url = "https://push2his.eastmoney.com/api/qt/kamt.kline/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f4",
            "fields2": "f51,f52,f53,f54,f55,f56",
            "lmt": 1,
            "klt": "101",
        }
        with httpx.Client(timeout=15, headers=EASTMONEY_HEADERS) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            return r.json()

    try:
        sh_data = await _asyncio.to_thread(_fetch_one, secids["sh"])
        sz_data = await _asyncio.to_thread(_fetch_one, secids["sz"])

        for prefix, data in [("sh", sh_data), ("sz", sz_data)]:
            klines = (data.get("data") or {}).get("klines") or []
            if klines and isinstance(klines, list) and klines:
                parts = str(klines[-1]).split(",")
                if len(parts) >= 6:
                    net = round(float(parts[4]) / 1e8, 2) if parts[4] != "-" else 0  # 转换为亿
                    result[f"{prefix}_net"] = net
                    if not result["date"]:
                        result["date"] = parts[0]

        result["total_net"] = round(result["sh_net"] + result["sz_net"], 2)
    except Exception as e:
        logger.warning("Northbound flow fetch error: %s", e)
        return result

    _set_cache("northbound_flow", result)
    return result


async def _tencent_stock_brief(code: str) -> dict[str, Any]:
    """Fetch fundamental data from Tencent stock API."""
    symbol = _tencent_symbol(code)
    url = f"http://qt.gtimg.cn/q={symbol}"
    async with httpx.AsyncClient(timeout=10, headers=TENCENT_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    m = re.search(r'"([^"]*)"', text)
    if not m:
        return {}
    parts = m.group(1).split("~")
    if len(parts) < 50:
        return {}

    def _f(idx: int) -> float:
        try:
            return float(parts[idx]) if parts[idx] else 0
        except (ValueError, IndexError):
            return 0

    return {
        "code": code,
        "market_cap": round(_f(44), 2),
        "pe": round(_f(39), 2),
        "pb": round(_f(46), 2),
        "high_52w": round(_f(47), 2),
        "low_52w": round(_f(48), 2),
        "amplitude": round(_f(43), 2),
        "total_shares": round(_f(72), 2),
        "turnover": round(_f(38), 2),
    }


async def _eastmoney_stock_brief(code: str) -> dict[str, Any]:
    """Fetch fundamental data from EastMoney (fallback source)."""
    market_id = "1" if code.startswith(("6", "5", "9")) else "0"
    secid = f"{market_id}.{code}"
    url = "https://push2.eastmoney.com/api/qt/stock/get"
    params = {
        "secid": secid,
        "fields": "f55,f115,f116,f167,f168,f169",
    }
    async with httpx.AsyncClient(timeout=10, headers=EASTMONEY_HEADERS) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    d = (data.get("data") or {}) if data else {}
    if not d:
        return {}

    def _f(key: str) -> float:
        try:
            v = d.get(key)
            return float(v) if v and str(v) != "-" else 0
        except (ValueError, TypeError):
            return 0

    return {
        "code": code,
        "market_cap": round(_f("f55") / 1e8, 2) if _f("f55") else 0,  # EM returns in 元, convert to 亿
        "pe": round(_f("f115"), 2),
        "pb": round(_f("f167"), 2),
        "high_52w": 0,
        "low_52w": 0,
        "amplitude": round(_f("f169"), 2),
        "total_shares": round(_f("f116") / 1e4, 2) if _f("f116") else 0,  # EM returns in 股, convert to 万股
        "turnover": round(_f("f168"), 2),
    }


async def get_stock_brief(code: str) -> dict[str, Any]:
    """Fetch fundamental data. Tencent → EastMoney fallback. Cached 5 min."""
    cache_key = f"stock_brief:{code}"
    cached = _get_cached(cache_key, 300.0)
    if cached is not None:
        return cached

    try:
        result = await _tencent_stock_brief(code)
        if result:
            _set_cache(cache_key, result)
            return result
    except Exception as e:
        logger.warning("Tencent stock brief failed for %s: %s", code, e)

    try:
        result = await _eastmoney_stock_brief(code)
        if result:
            _set_cache(cache_key, result)
            return result
    except Exception as e:
        logger.error("EastMoney stock brief also failed for %s: %s", code, e)

    return {}


async def calculate_cyq(code: str, period: str = "daily") -> dict[str, Any] | None:
    """Calculate chip distribution (CYQ) from K-line data using triangular distribution + turnover decay.

    Ported from AKShare / EastMoney's JavaScript CYQ algorithm.
    Returns price buckets and chip counts for drawing the chip peak chart.
    """
    klines = await get_kline(code, period, 150)
    if len(klines) < 20:
        return None

    FACTOR = 150
    RANGE = min(120, len(klines))
    kdata = klines[-RANGE:]

    max_price = 0.0
    min_price = float("inf")
    for k in kdata:
        h = k.get("high", 0) or 0
        l = k.get("low", 0) or 0
        if h > max_price:
            max_price = h
        if l < min_price:
            min_price = l

    if min_price <= 0 or max_price <= 0 or max_price <= min_price:
        return None

    accuracy = max(0.01, (max_price - min_price) / (FACTOR - 1))
    prices = [(min_price + accuracy * i) for i in range(FACTOR)]
    chips = [0.0] * FACTOR

    for k in kdata:
        o = k.get("open", 0) or 0
        c = k.get("close", 0) or 0
        h = k.get("high", 0) or 0
        l = k.get("low", 0) or 0
        avg = (o + c + h + l) / 4
        turnover = k.get("turnover_rate")
        if turnover is None or turnover == 0:
            turnover = 2.0  # default 2% turnover when data missing
        turnover = min(1.0, float(turnover) / 100)

        hi = int((h - min_price) / accuracy)
        lo = int((l - min_price) / accuracy + 0.5)
        g_idx = int((avg - min_price) / accuracy)

        # Decay
        for n in range(FACTOR):
            chips[n] *= (1 - turnover)

        if h == l:
            chips[g_idx] += (FACTOR - 1) * turnover / 2
        else:
            gp = 2 / (h - l)
            for j in range(lo, hi + 1):
                cur_price = min_price + accuracy * j
                if cur_price <= avg:
                    if abs(avg - l) < 1e-8:
                        chips[j] += gp * turnover
                    else:
                        chips[j] += (cur_price - l) / (avg - l) * gp * turnover
                else:
                    if abs(h - avg) < 1e-8:
                        chips[j] += gp * turnover
                    else:
                        chips[j] += (h - cur_price) / (h - avg) * gp * turnover

    total_chips = sum(chips)
    if total_chips <= 0:
        return None

    latest = kdata[-1]
    latest_price = float(latest.get("close", 0) or 0)
    if latest_price <= 0:
        return None

    # Compute weighted average cost
    weighted_sum = sum(prices[i] * chips[i] for i in range(FACTOR))
    avg_cost = weighted_sum / total_chips

    # Profit ratio: chips below latest_price / total
    profit_chips = sum(chips[i] for i in range(FACTOR) if prices[i] < latest_price)
    profit_ratio = round(profit_chips / total_chips, 4)

    # Compute cost ranges at 90% and 70% coverage
    l90, h90, conc90 = _cost_range(prices, chips, total_chips, 0.90)
    l70, h70, conc70 = _cost_range(prices, chips, total_chips, 0.70)

    # Normalize chips for frontend rendering
    max_chip = max(chips) if chips else 1
    chips_normalized = [round(c / max_chip, 6) for c in chips]
    prices_rounded = [round(p, 2) for p in prices]

    return {
        "latest_price": round(latest_price, 2),
        "profit_ratio": profit_ratio,
        "avg_cost": round(avg_cost, 2),
        "cost90_low": l90, "cost90_high": h90, "concentration90": conc90,
        "cost70_low": l70, "cost70_high": h70, "concentration70": conc70,
        "prices": prices_rounded,
        "chips": chips_normalized,
    }


def _cost_range(prices: list[float], chips: list[float], total: float, coverage: float):
    """Find the price range covering `coverage` fraction of total chips, centered on peak."""
    n = len(prices)
    # Find peak (mode) of chip distribution
    peak_idx = max(range(n), key=lambda i: chips[i])

    # Expand outward from peak until we cover coverage% of total chips
    lo = peak_idx
    hi = peak_idx
    acc_chips = chips[peak_idx]
    target = total * coverage

    while acc_chips < target and (lo > 0 or hi < n - 1):
        if lo > 0 and hi < n - 1:
            if chips[lo - 1] > chips[hi + 1]:
                lo -= 1
            elif chips[hi + 1] > chips[lo - 1]:
                hi += 1
            else:
                lo -= 1
                hi += 1
        elif lo > 0:
            lo -= 1
        elif hi < n - 1:
            hi += 1
        else:
            break

        if lo >= 0:
            acc_chips += chips[lo]
        if hi > lo:
            acc_chips += chips[hi]

    low_price = round(prices[max(0, lo)], 2)
    high_price = round(prices[min(n - 1, hi)], 2)
    concentration = round((high_price - low_price) / (high_price + low_price), 4) if (high_price + low_price) > 0 else 0

    return low_price, high_price, concentration

    return {}
