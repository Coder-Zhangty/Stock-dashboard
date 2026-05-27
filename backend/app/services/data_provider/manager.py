"""数据源管理器 — 多源注册、优先级路由、自动故障转移"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from .types import UnifiedQuote, UnifiedKline
from .base import BaseFetcher
from .circuit_breaker import CircuitBreaker, CircuitOpenError

logger = logging.getLogger(__name__)


class DataProviderManager:
    """按市场注册的多源数据管理器

    用法:
        mgr = DataProviderManager()
        mgr.register(eastmoney_fetcher)    # priority 0 (A-share)
        mgr.register(sina_fetcher)         # priority 1

        quote = await mgr.get_quote("000001", market="CN")
        # → 先试 eastmoney，失败自动 fallback 到 sina
    """

    def __init__(self):
        # market → sorted fetchers (by priority)
        self._fetchers: dict[str, list[BaseFetcher]] = {}
        self._breakers: dict[str, CircuitBreaker] = {}  # fetcher_name → breaker
        self._health_interval = 300  # 健康检查间隔 (秒)
        self._last_health_check: dict[str, float] = {}

    def register(self, fetcher: BaseFetcher) -> None:
        """注册一个数据源"""
        breaker = CircuitBreaker(
            failure_threshold=3,
            cooldown_seconds=60.0,
            name=fetcher.name,
        )
        self._breakers[fetcher.name] = breaker

        for market in fetcher.markets:
            if market not in self._fetchers:
                self._fetchers[market] = []
            self._fetchers[market].append(fetcher)
            # 按优先级排序
            self._fetchers[market].sort(key=lambda f: f.priority)

        logger.info(
            "注册数据源: %s (priority=%d, markets=%s)",
            fetcher.name, fetcher.priority, fetcher.markets,
        )

    def get_fetchers(self, market: str) -> list[BaseFetcher]:
        """获取某市场的所有数据源（按优先级排序）"""
        return self._fetchers.get(market, [])

    async def get_quote(self, code: str, market: str) -> UnifiedQuote | None:
        """获取单只股票报价 — 自动故障转移"""
        fetchers = self.get_fetchers(market)
        if not fetchers:
            logger.warning("市场 %s 没有注册数据源", market)
            return None

        errors: list[str] = []
        for fetcher in fetchers:
            breaker = self._breakers.get(fetcher.name)
            if breaker is None:
                continue

            try:
                if breaker:
                    result = await breaker.call(fetcher.fetch_quote, code, market)
                else:
                    result = await fetcher.fetch_quote(code, market)
                if result is not None:
                    return result
            except CircuitOpenError:
                errors.append(f"{fetcher.name}: 断路器熔断")
                continue
            except Exception as e:
                errors.append(f"{fetcher.name}: {e}")
                continue

        logger.warning("所有数据源获取 %s 失败: %s", code, "; ".join(errors) if errors else "无可用源")
        return None

    async def get_batch(self, codes: list[str], market: str) -> dict[str, UnifiedQuote]:
        """批量获取报价"""
        if not codes:
            return {}

        fetchers = self.get_fetchers(market)
        if not fetchers:
            return {}

        # 尝试批量接口优先
        for fetcher in fetchers:
            breaker = self._breakers.get(fetcher.name)
            if breaker is None:
                continue
            if not fetcher.supports_batch:
                continue
            try:
                if breaker:
                    results = await breaker.call(fetcher.fetch_batch, codes, market)
                else:
                    results = await fetcher.fetch_batch(codes, market)
                if results:
                    return results
            except CircuitOpenError:
                continue
            except Exception:
                continue

        # Fallback: 逐个获取
        import asyncio as _asyncio
        sem = _asyncio.Semaphore(5)

        async def _one(code: str):
            async with sem:
                return code, await self.get_quote(code, market)

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

    async def get_kline(
        self, code: str, market: str, period: str = "daily", count: int = 120
    ) -> list[UnifiedKline]:
        """获取K线 — 自动故障转移"""
        fetchers = self.get_fetchers(market)
        if not fetchers:
            return []

        for fetcher in fetchers:
            breaker = self._breakers.get(fetcher.name)
            if breaker is None:
                continue
            if not fetcher.supports_kline:
                continue
            try:
                if breaker:
                    result = await breaker.call(fetcher.fetch_kline, code, market, period, count)
                else:
                    result = await fetcher.fetch_kline(code, market, period, count)
                if result:
                    return result
            except CircuitOpenError:
                continue
            except Exception:
                continue

        return []

    async def get_indices(self, codes: list[str], market: str) -> list[UnifiedQuote]:
        """获取指数报价"""
        fetchers = self.get_fetchers(market)
        if not fetchers:
            return []

        for fetcher in fetchers:
            if not fetcher.supports_indices:
                continue
            breaker = self._breakers.get(fetcher.name)
            try:
                if breaker:
                    results = await breaker.call(fetcher.fetch_indices, codes)
                else:
                    results = await fetcher.fetch_indices(codes)
                if results:
                    return results
            except CircuitOpenError:
                continue
            except Exception:
                continue

        return []

    def health_summary(self) -> dict[str, Any]:
        """返回所有数据源健康状态摘要"""
        report: dict[str, Any] = {}
        for name, breaker in self._breakers.items():
            report[name] = {
                "state": breaker.state.value,
                "failures": breaker.failure_count,
                "last_failure": breaker.last_failure_time,
                "last_success": breaker.last_success_time,
            }
        return report


def init_providers() -> DataProviderManager:
    """注册所有数据源到全局管理器。在应用启动时调用一次。"""
    from .fetchers_eastmoney import EastMoneyFetcher, EastMoneyHKFetcher, EastMoneyUSFetcher
    from .fetchers_sina import SinaFetcher
    from .fetchers_tencent import TencentCNFetcher, TencentHKFetcher
    from .fetchers_yahoo import YahooUSFetcher

    # CN 市场: EastMoney(0) → Tencent(1) → Sina(2)
    data_provider.register(EastMoneyFetcher())
    data_provider.register(TencentCNFetcher())
    data_provider.register(SinaFetcher())

    # HK 市场: EastMoneyHK(0) → TencentHK(1)
    data_provider.register(EastMoneyHKFetcher())
    data_provider.register(TencentHKFetcher())

    # US 市场: Yahoo(0) → EastMoneyUS(1)
    data_provider.register(YahooUSFetcher())
    data_provider.register(EastMoneyUSFetcher())

    logger.info("数据源管理器初始化完成")
    return data_provider


# 全局单例
data_provider = DataProviderManager()
