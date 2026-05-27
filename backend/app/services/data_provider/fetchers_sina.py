"""新浪财经数据源 — A股行情 / K线"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from .base import BaseFetcher
from .types import UnifiedQuote, UnifiedKline

logger = logging.getLogger(__name__)

SINA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
}

SINA_KL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/stock/",
}

PERIOD_SCALE = {"daily": 240, "weekly": 1200, "monthly": 7200}


def _sina_symbol(code: str) -> str:
    c = str(code).strip()
    if c.startswith(("6", "5", "9")):
        return f"sh{c}"
    return f"sz{c}"


def _parse_sina_line(line: str) -> dict[str, Any] | None:
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

    return {
        "name": parts[0], "open": _f(1), "prev_close": _f(2),
        "latest_price": _f(3), "high": _f(4), "low": _f(5),
        "volume": _f(8), "amount": _f(9),
    }


class SinaFetcher(BaseFetcher):
    """A股行情 — 新浪财经 (fallback source)"""

    name = "sina_cn"
    priority = 2
    supports_spot = True
    supports_kline = True
    supports_batch = True
    markets = ["CN"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            symbol = _sina_symbol(code)
            async with httpx.AsyncClient(timeout=self.timeout, headers=SINA_HEADERS) as client:
                resp = await client.get(f"https://hq.sinajs.cn/list={symbol}")
                resp.raise_for_status()
                data = _parse_sina_line(resp.text)
            if not data:
                return None
            prev = data["prev_close"]
            price = data["latest_price"]
            change = price - prev if prev else 0
            pct = (change / prev * 100) if prev else 0
            return UnifiedQuote(
                code=code, name=data["name"], market="CN",
                latest_price=round(price, 2),
                prev_close=round(prev, 2),
                change_pct=round(pct, 2),
                change_amount=round(change, 2),
                open=data["open"], high=data["high"], low=data["low"],
                volume=data["volume"], amount=data["amount"],
                source=self.name,
            )
        except Exception as e:
            logger.debug("Sina quote error for %s: %s", code, e)
            return None

    async def fetch_batch(self, codes: list[str], market: str = "") -> dict[str, UnifiedQuote]:
        if not codes:
            return {}
        symbols = [_sina_symbol(c) for c in codes]
        try:
            async with httpx.AsyncClient(timeout=20, headers=SINA_HEADERS) as client:
                resp = await client.get(f"https://hq.sinajs.cn/list={','.join(symbols)}")
                resp.raise_for_status()
                text = resp.text
        except Exception as e:
            logger.warning("Sina batch error: %s", e)
            return {}

        results: dict[str, UnifiedQuote] = {}
        for i, line in enumerate(text.strip().splitlines()):
            data = _parse_sina_line(line)
            if data and i < len(codes):
                code = codes[i]
                prev = data["prev_close"]
                price = data["latest_price"]
                change = price - prev if prev else 0
                pct = (change / prev * 100) if prev else 0
                results[code] = UnifiedQuote(
                    code=code, name=data["name"], market="CN",
                    latest_price=round(price, 2),
                    prev_close=round(prev, 2),
                    change_pct=round(pct, 2),
                    change_amount=round(change, 2),
                    open=data["open"], high=data["high"], low=data["low"],
                    volume=data["volume"], amount=data["amount"],
                    source=self.name,
                )
        return results

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        scale = PERIOD_SCALE.get(period)
        if not scale:
            return []
        try:
            symbol = _sina_symbol(code)
            url = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
            params = {"symbol": symbol, "scale": scale, "ma": "no", "datalen": count * 2}
            async with httpx.AsyncClient(timeout=20, headers=SINA_KL_HEADERS) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                raw = resp.json()
            if not isinstance(raw, list) or not raw:
                return []
            results: list[UnifiedKline] = []
            for item in raw[-count:]:
                results.append(UnifiedKline(
                    code=code, trade_date=item.get("day", ""),
                    open=float(item.get("open", 0) or 0),
                    close=float(item.get("close", 0) or 0),
                    high=float(item.get("high", 0) or 0),
                    low=float(item.get("low", 0) or 0),
                    volume=float(item.get("volume", 0) or 0),
                    source=self.name,
                ))
            return results
        except Exception as e:
            logger.debug("Sina kline error for %s: %s", code, e)
            return []
