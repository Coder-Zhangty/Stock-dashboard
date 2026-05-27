"""腾讯数据源 — A股行情(含PE/PB/市值) / 港股行情+K线"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from .base import BaseFetcher
from .types import UnifiedQuote, UnifiedKline

logger = logging.getLogger(__name__)

TENCENT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://gu.qq.com/",
}


def _cn_symbol(code: str) -> str:
    c = str(code).strip()
    if c.startswith(("6", "5", "9")):
        return f"sh{c}"
    return f"sz{c}"


def _parse_tencent_line(line: str) -> dict[str, Any] | None:
    """Parse a Tencent quote line like: v_sh600519="..."""
    m = re.search(r'"([^"]*)"', line)
    if not m:
        return None
    parts = m.group(1).split("~")
    if len(parts) < 50:
        return None

    def _f(idx: int) -> float:
        try:
            return float(parts[idx]) if idx < len(parts) and parts[idx] else 0
        except (ValueError, IndexError):
            return 0

    name = parts[1]
    # Tencent uses parts[2] as code — prefer extracting from the var name
    var_match = re.search(r'v_s[hz](\d+)', line)
    code = var_match.group(1) if var_match else parts[2]

    return {
        "code": code, "name": name,
        "latest_price": _f(3), "prev_close": _f(4),
        "open": _f(5), "high": _f(33), "low": _f(34),
        "volume": _f(6), "amount": _f(37),
        "turnover": _f(38), "turnover_rate": _f(38),
        "pe": _f(39), "pe_ttm": _f(52), "pb": _f(46),
        "amplitude": _f(43),
        "total_market_cap": _f(45), "circulating_market_cap": _f(44),
        "high_52w": _f(47), "low_52w": _f(48),
        "volume_ratio": _f(49),
    }


# ═══════════════════════════════════════════
# A-share via Tencent
# ═══════════════════════════════════════════

class TencentCNFetcher(BaseFetcher):
    """A股行情 — 腾讯数据源 (rich data: PE/PB/市值/52周高低)"""

    name = "tencent_cn"
    priority = 1
    supports_spot = True
    supports_kline = False  # 腾讯无A股K线，走EastMoney/Sina
    supports_batch = True
    supports_indices = True
    markets = ["CN"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            symbol = _cn_symbol(code)
            async with httpx.AsyncClient(timeout=self.timeout, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q={symbol}")
                resp.raise_for_status()
                data = _parse_tencent_line(resp.text)
            if not data:
                return None
            return _build_cn_quote(data, self.name)
        except Exception as e:
            logger.debug("Tencent CN quote error for %s: %s", code, e)
            return None

    async def fetch_batch(self, codes: list[str], market: str = "") -> dict[str, UnifiedQuote]:
        if not codes:
            return {}
        symbols = [_cn_symbol(c) for c in codes]
        try:
            async with httpx.AsyncClient(timeout=20, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q={','.join(symbols)}")
                resp.raise_for_status()
                text = resp.text
        except Exception as e:
            logger.warning("Tencent CN batch error: %s", e)
            return {}

        results: dict[str, UnifiedQuote] = {}
        for line in text.strip().splitlines():
            if not line.strip():
                continue
            data = _parse_tencent_line(line)
            if data and data["code"] in codes:
                results[data["code"]] = _build_cn_quote(data, self.name)
        return results

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        return []

    async def fetch_indices(self, codes: list[str]) -> list[UnifiedQuote]:
        """Fetch A-share indices from Tencent."""
        INDEX_NAMES = {
            "000001": "上证指数", "399001": "深证成指", "399006": "创业板指",
            "000300": "沪深300", "000688": "科创50", "000016": "上证50",
            "000905": "中证500", "899050": "北证50",
        }

        def _idx_symbol(c: str) -> str:
            if c.startswith("89"):
                return f"bj{c}"
            if c.startswith(("0", "6", "5", "9")):
                return f"sh{c}"
            return f"sz{c}"

        symbols = [_idx_symbol(c) for c in codes]
        try:
            async with httpx.AsyncClient(timeout=10, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q={','.join(symbols)}")
                resp.raise_for_status()
                text = resp.text
        except Exception as e:
            logger.warning("Tencent indices error: %s", e)
            return []

        results: list[UnifiedQuote] = []
        for line in text.strip().splitlines():
            m = re.search(r'"([^"]*)"', line)
            if not m:
                continue
            parts = m.group(1).split("~")
            if len(parts) < 40:
                continue
            try:
                code = parts[2]
                if code not in codes:
                    continue
                name = INDEX_NAMES.get(code, parts[1])
                price = float(parts[3]) if parts[3] else 0
                change = float(parts[31]) if parts[31] else 0
                pct = float(parts[32]) if parts[32] else 0
                results.append(UnifiedQuote(
                    code=code, name=name, market="CN",
                    latest_price=round(price, 2),
                    change_amount=round(change, 2),
                    change_pct=round(pct, 2),
                    source=self.name,
                ))
            except (ValueError, IndexError):
                continue
        return results


def _build_cn_quote(data: dict, source: str) -> UnifiedQuote:
    prev = data["prev_close"]
    price = data["latest_price"]
    change = price - prev if prev else 0
    pct = (change / prev * 100) if prev else 0
    return UnifiedQuote(
        code=data["code"], name=data["name"], market="CN",
        latest_price=round(price, 2),
        prev_close=round(prev, 2),
        change_pct=round(pct, 2),
        change_amount=round(change, 2),
        open=data["open"], high=data["high"], low=data["low"],
        volume=data["volume"], amount=data["amount"],
        turnover=data["turnover"], turnover_rate=data["turnover_rate"],
        pe=data["pe"], pb=data["pb"],
        market_cap=data["total_market_cap"],
        high_52w=data["high_52w"], low_52w=data["low_52w"],
        amplitude=data["amplitude"],
        source=source,
    )


# ═══════════════════════════════════════════
# HK via Tencent
# ═══════════════════════════════════════════

class TencentHKFetcher(BaseFetcher):
    """港股行情 — 腾讯数据源"""

    name = "tencent_hk"
    priority = 1
    supports_spot = True
    supports_kline = True
    supports_batch = True
    supports_indices = True
    markets = ["HK"]

    def __init__(self, timeout: float = 15.0):
        super().__init__(timeout)

    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q=hk{code}")
                resp.raise_for_status()
                data = _parse_hk_line(resp.text, code)
            if not data:
                return None
            return _build_hk_quote(data, self.name)
        except Exception as e:
            logger.debug("Tencent HK quote error for %s: %s", code, e)
            return None

    async def fetch_batch(self, codes: list[str], market: str = "") -> dict[str, UnifiedQuote]:
        if not codes:
            return {}
        symbols = [f"hk{c}" for c in codes]
        try:
            async with httpx.AsyncClient(timeout=20, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q={','.join(symbols)}")
                resp.raise_for_status()
                text = resp.text
        except Exception as e:
            logger.warning("Tencent HK batch error: %s", e)
            return {}

        results: dict[str, UnifiedQuote] = {}
        for line in text.strip().splitlines():
            if not line.strip():
                continue
            m = re.search(r'v_hk(\d+)="', line)
            if not m:
                continue
            code = m.group(1)
            data = _parse_hk_line(line, code)
            if data:
                results[code] = _build_hk_quote(data, self.name)
        return results

    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        period_map = {"daily": "day", "weekly": "week", "monthly": "month"}
        ktype = period_map.get(period, "day")
        url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=hk{code},{ktype},,,{count},qfq"
        try:
            async with httpx.AsyncClient(timeout=15, headers=TENCENT_HEADERS) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.debug("Tencent HK kline error for %s: %s", code, e)
            return []

        try:
            stock_key = f"hk{code}"
            kline_data = data.get("data", {}).get(stock_key, {})
            key = f"qfq{ktype}" if f"qfq{ktype}" in kline_data else ktype
            rows = kline_data.get(key, [])
        except Exception:
            return []

        results: list[UnifiedKline] = []
        for row in rows:
            if len(row) < 6:
                continue
            try:
                results.append(UnifiedKline(
                    code=code, trade_date=str(row[0]),
                    open=float(row[1]) if row[1] else 0,
                    close=float(row[2]) if row[2] else 0,
                    high=float(row[3]) if row[3] else 0,
                    low=float(row[4]) if row[4] else 0,
                    volume=float(row[5]) if row[5] else 0,
                    source=self.name,
                ))
            except (ValueError, IndexError):
                continue
        return results

    async def fetch_indices(self, codes: list[str]) -> list[UnifiedQuote]:
        HK_INDEX_NAMES = {
            "HSI": "恒生指数", "HSCEI": "国企指数",
            "HSCCI": "红筹指数", "HSTECH": "恒生科技",
        }
        symbols = [f"hk{c}" for c in codes]
        try:
            async with httpx.AsyncClient(timeout=10, headers=TENCENT_HEADERS) as client:
                resp = await client.get(f"http://qt.gtimg.cn/q={','.join(symbols)}")
                resp.raise_for_status()
                text = resp.text
        except Exception as e:
            logger.warning("Tencent HK indices error: %s", e)
            return []

        results: list[UnifiedQuote] = []
        for line in text.strip().splitlines():
            if not line.strip():
                continue
            for key, name in HK_INDEX_NAMES.items():
                if f"hk{key}" in line:
                    m = re.search(r'"([^"]*)"', line)
                    if not m:
                        continue
                    parts = m.group(1).split("~")
                    if len(parts) < 4:
                        continue
                    try:
                        price = float(parts[3]) if parts[3] else 0
                        prev = float(parts[4]) if parts[4] else 0
                        pct = (price - prev) / prev * 100 if prev else 0
                        results.append(UnifiedQuote(
                            code=key, name=name, market="HK",
                            latest_price=round(price, 2),
                            change_pct=round(pct, 2),
                            change_amount=round(price - prev, 2),
                            currency="HKD",
                            source=self.name,
                        ))
                    except (ValueError, IndexError):
                        continue
                    break
        return results


def _parse_hk_line(text: str, fallback_code: str = "") -> dict[str, Any] | None:
    m = re.search(r'"([^"]*)"', text)
    if not m:
        return None
    parts = m.group(1).split("~")
    if len(parts) < 50:
        return None
    return {"code": fallback_code, "parts": parts}


def _build_hk_quote(data: dict, source: str) -> UnifiedQuote:
    parts = data["parts"]
    code = data["code"]
    price = float(parts[3]) if parts[3] else 0
    prev = float(parts[4]) if parts[4] else 0
    change = price - prev
    pct = (change / prev * 100) if prev > 0 else 0
    return UnifiedQuote(
        code=code, name=parts[1], market="HK",
        latest_price=round(price, 2),
        prev_close=round(prev, 2),
        change_pct=round(pct, 2),
        change_amount=round(change, 2),
        open=float(parts[5]) if parts[5] else 0,
        high=float(parts[33]) if len(parts) > 33 and parts[33] else 0,
        low=float(parts[34]) if len(parts) > 34 and parts[34] else 0,
        volume=float(parts[6]) if parts[6] else 0,
        amount=float(parts[37]) if len(parts) > 37 and parts[37] else 0,
        currency="HKD",
        source=source,
    )
