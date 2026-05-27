"""Yahoo Finance 数据源 — 美股行情 / K线"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import BaseFetcher
from .types import UnifiedQuote, UnifiedKline

logger = logging.getLogger(__name__)

US_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


class YahooUSFetcher(BaseFetcher):
    """美股行情 — Yahoo Finance v8 (primary source)"""

    name = "yahoo_us"
    priority = 0
    supports_spot = True
    supports_kline = True
    supports_batch = True
    supports_indices = True
    markets = ["US"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            meta = await _fetch_yahoo_meta(code, self.timeout)
            if meta is None:
                return None
            return _build_us_quote(code, meta, self.name)
        except Exception as e:
            logger.debug("Yahoo US quote error for %s: %s", code, e)
            return None

    async def fetch_batch(self, codes: list[str], market: str = "") -> dict[str, UnifiedQuote]:
        if not codes:
            return {}
        import asyncio as _asyncio
        sem = _asyncio.Semaphore(5)

        async def _one(sym: str):
            async with sem:
                return sym, await self.fetch_quote(sym)

        tasks = [_one(s) for s in codes]
        done = await _asyncio.gather(*tasks, return_exceptions=True)
        results: dict[str, UnifiedQuote] = {}
        for item in done:
            if isinstance(item, Exception):
                continue
            sym, quote = item
            if quote:
                results[sym] = quote
        return results

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        interval_map = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
        interval = interval_map.get(period, "1d")

        if period == "daily":
            range_str = "6mo" if count <= 130 else "1y"
        elif period == "weekly":
            range_str = "2y"
        else:
            range_str = "5y"

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{code}"
        params = {"range": range_str, "interval": interval}
        try:
            async with httpx.AsyncClient(timeout=15, headers=US_HEADERS) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.debug("Yahoo kline error for %s: %s", code, e)
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
            logger.debug("Yahoo kline parse error for %s: %s", code, e)
            return []

        results: list[UnifiedKline] = []
        for i, ts in enumerate(timestamps):
            try:
                results.append(UnifiedKline(
                    code=code,
                    trade_date=datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                    open=round(opens[i], 2) if opens[i] is not None else 0,
                    close=round(closes[i], 2) if closes[i] is not None else 0,
                    high=round(highs[i], 2) if highs[i] is not None else 0,
                    low=round(lows[i], 2) if lows[i] is not None else 0,
                    volume=volumes[i] or 0,
                    source=self.name,
                ))
            except (IndexError, TypeError, ValueError):
                continue
        return results[-count:] if len(results) > count else results

    async def fetch_indices(self, codes: list[str]) -> list[UnifiedQuote]:
        US_INDEX_NAMES = {
            "^DJI": "道琼斯", "^IXIC": "纳斯达克", "^GSPC": "标普500",
        }
        results: list[UnifiedQuote] = []
        for code in codes:
            q = await self.fetch_quote(code)
            if q:
                q.name = US_INDEX_NAMES.get(code, q.name)
                results.append(q)
        return results


async def _fetch_yahoo_meta(symbol: str, timeout: float = 15.0) -> dict[str, Any] | None:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": "1d", "interval": "1m"}
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=US_HEADERS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.debug("Yahoo fetch error for %s: %s", symbol, e)
        return None

    try:
        return data["chart"]["result"][0]["meta"]
    except (KeyError, IndexError, TypeError):
        return None


def _build_us_quote(symbol: str, meta: dict, source: str) -> UnifiedQuote:
    price = meta.get("regularMarketPrice", 0)
    prev = meta.get("chartPreviousClose", meta.get("previousClose", 0))
    change = price - prev if price and prev else 0
    pct = (change / prev * 100) if prev else 0

    return UnifiedQuote(
        code=symbol,
        name=meta.get("shortName", meta.get("symbol", symbol)),
        market="US",
        latest_price=round(price, 2),
        prev_close=round(prev, 2),
        open=round(meta.get("regularMarketOpen", 0), 2),
        high=round(meta.get("regularMarketDayHigh", 0), 2),
        low=round(meta.get("regularMarketDayLow", 0), 2),
        volume=meta.get("regularMarketVolume", 0),
        change_pct=round(pct, 2),
        change_amount=round(change, 2),
        currency=meta.get("currency", "USD"),
        market_cap=meta.get("marketCap", 0),
        pe=meta.get("trailingPE", 0),
        high_52w=meta.get("fiftyTwoWeekHigh", 0),
        low_52w=meta.get("fiftyTwoWeekLow", 0),
        source=source,
    )
