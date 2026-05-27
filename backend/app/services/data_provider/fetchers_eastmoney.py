"""东方财富数据源 — A股行情 / 港股行情 / 美股行情"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from .base import BaseFetcher
from .types import UnifiedQuote, UnifiedKline

logger = logging.getLogger(__name__)

EM_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://quote.eastmoney.com/",
}


# ═══════════════════════════════════════════
# A-share
# ═══════════════════════════════════════════

class EastMoneyFetcher(BaseFetcher):
    """A股行情 — 东方财富 push2 API"""

    name = "eastmoney_cn"
    priority = 0
    supports_spot = True
    supports_kline = True
    supports_batch = True
    supports_indices = True
    markets = ["CN"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout, headers=EM_HEADERS)
        return self._client

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        """东方财富实时行情 — 单只股票"""
        try:
            client = await self._get_client()
            secid = _to_em_secid(code, market)
            resp = await client.get(
                "http://push2.eastmoney.com/api/qt/stock/get",
                params={
                    "secid": secid,
                    "fields": "f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f116,f117,f162,f167,f169,f170",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            d = (data.get("data") or {})
            if not d:
                return None
            prev = d.get("f60", 0) or d.get("f18", 0)
            price = d.get("f43", 0) or 0
            change = d.get("f169", 0) or (price - prev if price and prev else 0)
            pct = d.get("f170", 0) or (change / prev * 100 if prev else 0)
            return UnifiedQuote(
                code=code,
                name=d.get("f58", "") or "",
                market="CN",
                latest_price=float(price) / 100 if price > 10000 else price,
                prev_close=float(prev) / 100 if prev > 10000 else prev,
                change_pct=round(float(pct), 2),
                change_amount=round(float(change), 2),
                open=float(d.get("f46", 0) or 0),
                high=float(d.get("f44", 0) or 0),
                low=float(d.get("f45", 0) or 0),
                volume=float(d.get("f47", 0) or 0),
                amount=float(d.get("f48", 0) or 0),
                turnover=float(d.get("f168", 0) or 0),
                turnover_rate=float(d.get("f168", 0) or 0),
                pe=float(d.get("f162", 0) or 0),
                market_cap=float(d.get("f116", 0) or 0),
                source=self.name,
            )
        except Exception as e:
            logger.debug("EastMoney quote error for %s: %s", code, e)
            return None

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        try:
            client = await self._get_client()
            secid = _to_em_secid(code, market)
            klt_map = {"daily": 101, "weekly": 102, "monthly": 103}
            resp = await client.get(
                "https://push2his.eastmoney.com/api/qt/stock/kline/get",
                params={
                    "secid": secid,
                    "fields1": "f1,f2,f3,f4,f5,f6",
                    "fields2": "f51,f52,f53,f54,f55,f56,f57",
                    "klt": klt_map.get(period, 101),
                    "fqt": 1,
                    "end": "20500101",
                    "lmt": count,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            klines = (data.get("data", {}) or {}).get("klines", []) or []
            results: list[UnifiedKline] = []
            for line in klines[-count:]:
                parts = line.split(",")
                if len(parts) >= 6:
                    results.append(UnifiedKline(
                        code=code, trade_date=parts[0],
                        open=float(parts[1]), close=float(parts[2]),
                        high=float(parts[3]), low=float(parts[4]),
                        volume=float(parts[5]), amount=float(parts[6]) if len(parts) > 6 else 0,
                        source=self.name,
                    ))
            return results
        except Exception as e:
            logger.debug("EastMoney kline error for %s: %s", code, e)
            return []

    async def fetch_indices(self, codes: list[str]) -> list[UnifiedQuote]:
        quotes = []
        for code in codes:
            q = await self.fetch_quote(code, "CN")
            if q:
                quotes.append(q)
        return quotes


# ═══════════════════════════════════════════
# HK stocks
# ═══════════════════════════════════════════

class EastMoneyHKFetcher(BaseFetcher):
    """港股行情 — 东方财富 API"""

    name = "eastmoney_hk"
    priority = 0
    supports_spot = True
    supports_kline = True
    supports_batch = True
    supports_indices = True
    markets = ["HK"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=EM_HEADERS) as client:
                resp = await client.get(
                    "http://push2.eastmoney.com/api/qt/clist/get",
                    params={
                        "pn": 1, "pz": 1, "po": 0, "np": 1,
                        "fltt": 2, "invt": 2, "fid": "f12",
                        "fs": f"m:128+t:3,b:{code}",
                        "fields": "f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                items = (data.get("data", {}) or {}).get("diff", []) or []
                if not items:
                    return None
                item = items[0]
                return UnifiedQuote(
                    code=code,
                    name=item.get("f14", "") or "",
                    market="HK",
                    latest_price=item.get("f2", 0) or 0,
                    prev_close=item.get("f18", 0) or 0,
                    change_pct=item.get("f3", 0) or 0,
                    change_amount=item.get("f4", 0) or 0,
                    open=item.get("f17", 0) or 0,
                    high=item.get("f15", 0) or 0,
                    low=item.get("f16", 0) or 0,
                    volume=item.get("f5", 0) or 0,
                    amount=item.get("f6", 0) or 0,
                    source=self.name,
                    currency="HKD",
                )
        except Exception as e:
            logger.debug("EastMoney HK quote error for %s: %s", code, e)
            return None

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        try:
            client = httpx.AsyncClient(timeout=self.timeout, headers=EM_HEADERS)
            async with client:
                secid = _to_em_secid(code, "HK")
                klt_map = {"daily": 101, "weekly": 102, "monthly": 103}
                resp = await client.get(
                    "https://push2his.eastmoney.com/api/qt/stock/kline/get",
                    params={
                        "secid": secid,
                        "fields1": "f1,f2,f3,f4,f5,f6",
                        "fields2": "f51,f52,f53,f54,f55,f56,f57",
                        "klt": klt_map.get(period, 101),
                        "fqt": 1,
                        "end": "20500101",
                        "lmt": count,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                klines = (data.get("data", {}) or {}).get("klines", []) or []
                results: list[UnifiedKline] = []
                for line in klines[-count:]:
                    parts = line.split(",")
                    if len(parts) >= 6:
                        results.append(UnifiedKline(
                            code=code, trade_date=parts[0],
                            open=float(parts[1]), close=float(parts[2]),
                            high=float(parts[3]), low=float(parts[4]),
                            volume=float(parts[5]),
                            amount=float(parts[6]) if len(parts) > 6 else 0,
                            source=self.name,
                        ))
                return results
        except Exception as e:
            logger.debug("EastMoney HK kline error for %s: %s", code, e)
            return []


# ═══════════════════════════════════════════
# US stocks
# ═══════════════════════════════════════════

class EastMoneyUSFetcher(BaseFetcher):
    """美股行情 — 东方财富 API"""

    name = "eastmoney_us"
    priority = 1  # 次于 Yahoo
    supports_spot = True
    supports_kline = True
    markets = ["US"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=EM_HEADERS) as client:
                resp = await client.get(
                    "http://push2.eastmoney.com/api/qt/clist/get",
                    params={
                        "pn": 1, "pz": 1, "po": 0, "np": 1,
                        "fltt": 2, "invt": 2, "fid": "f12",
                        "fs": f"m:105,b:{code}",
                        "fields": "f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18,f20",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                items = (data.get("data", {}) or {}).get("diff", []) or []
                if not items:
                    return None
                item = items[0]
                mcap = item.get("f20", 0) or 0
                return UnifiedQuote(
                    code=code,
                    name=item.get("f14", "") or "",
                    market="US",
                    latest_price=item.get("f2", 0) or 0,
                    prev_close=item.get("f18", 0) or 0,
                    change_pct=item.get("f3", 0) or 0,
                    change_amount=item.get("f4", 0) or 0,
                    open=item.get("f17", 0) or 0,
                    high=item.get("f15", 0) or 0,
                    low=item.get("f16", 0) or 0,
                    volume=item.get("f5", 0) or 0,
                    amount=item.get("f6", 0) or 0,
                    market_cap=mcap / 1e8 if mcap else 0,
                    source=self.name,
                    currency="USD",
                )
        except Exception as e:
            logger.debug("EastMoney US quote error for %s: %s", code, e)
            return None

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        try:
            client = httpx.AsyncClient(timeout=self.timeout, headers=EM_HEADERS)
            async with client:
                secid = _to_em_secid(code, "US")
                klt_map = {"daily": 101, "weekly": 102, "monthly": 103}
                resp = await client.get(
                    "https://push2his.eastmoney.com/api/qt/stock/kline/get",
                    params={
                        "secid": secid,
                        "fields1": "f1,f2,f3,f4,f5,f6",
                        "fields2": "f51,f52,f53,f54,f55,f56,f57",
                        "klt": klt_map.get(period, 101),
                        "fqt": 1,
                        "end": "20500101",
                        "lmt": count,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                klines = (data.get("data", {}) or {}).get("klines", []) or []
                results: list[UnifiedKline] = []
                for line in klines[-count:]:
                    parts = line.split(",")
                    if len(parts) >= 6:
                        results.append(UnifiedKline(
                            code=code, trade_date=parts[0],
                            open=float(parts[1]), close=float(parts[2]),
                            high=float(parts[3]), low=float(parts[4]),
                            volume=float(parts[5]),
                            amount=float(parts[6]) if len(parts) > 6 else 0,
                            source=self.name,
                        ))
                return results
        except Exception as e:
            logger.debug("EastMoney US kline error for %s: %s", code, e)
            return []


# ═══════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════

def _to_em_secid(code: str, market: str = "CN") -> str:
    """股票代码 → 东方财富 secid"""
    if market == "CN":
        if code.startswith("6") or code.startswith("68"):
            return f"1.{code}"
        return f"0.{code}"
    if market == "HK":
        return f"116.{code}"
    if market == "US":
        return f"105.{code}"  # NASDAQ default
    return f"0.{code}"
