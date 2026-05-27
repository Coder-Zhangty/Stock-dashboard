"""数据源抽象基类 — 所有 Fetcher 的公共接口"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from .types import UnifiedQuote, UnifiedKline

logger = logging.getLogger(__name__)


class BaseFetcher(ABC):
    """数据源抽象基类"""

    name: str = "base"                # 唯一标识，如 "eastmoney", "sina"
    priority: int = 100               # 越小越优先 (0=最高)
    supports_spot: bool = True        # 支持实时行情
    supports_kline: bool = True       # 支持K线
    supports_batch: bool = False      # 支持批量查询
    supports_indices: bool = False    # 支持指数查询
    markets: list[str] = []           # ["CN", "HK", "US"]

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self._healthy = True

    @property
    def healthy(self) -> bool:
        return self._healthy

    def mark_unhealthy(self) -> None:
        self._healthy = False

    def mark_healthy(self) -> None:
        self._healthy = True

    @abstractmethod
    async def fetch_quote(self, code: str, market: str = "") -> UnifiedQuote | None:
        """获取单只股票实时报价"""

    async def fetch_batch(self, codes: list[str], market: str = "") -> dict[str, UnifiedQuote]:
        """批量获取报价（默认逐个调用，子类可覆盖优化）"""
        import asyncio as _asyncio

        sem = _asyncio.Semaphore(5)

        async def _one(code: str):
            async with sem:
                return code, await self.fetch_quote(code, market)

        tasks = [_one(c) for c in codes]
        done = await _asyncio.gather(*tasks, return_exceptions=True)
        results: dict[str, UnifiedQuote] = {}
        for item in done:
            if isinstance(item, Exception):
                continue
            code, quote = item
            if quote:
                results[code] = quote
        return results

    @abstractmethod
    async def fetch_kline(
        self, code: str, market: str = "", period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        """获取K线数据"""

    async def fetch_indices(self, codes: list[str]) -> list[UnifiedQuote]:
        """获取指数报价（子类按需覆盖）"""
        results: list[UnifiedQuote] = []
        for code in codes:
            q = await self.fetch_quote(code, "")
            if q:
                results.append(q)
        return results

    async def health_check(self) -> bool:
        """快速健康检查（各子类覆盖）"""
        return self.healthy
