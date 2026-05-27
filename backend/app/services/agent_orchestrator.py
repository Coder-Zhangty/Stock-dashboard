"""Agent 编排器 — 策略匹配 + 股票筛选 + 评分排名"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.services.strategy_loader import Strategy, strategy_loader

logger = logging.getLogger(__name__)


@dataclass
class ScreeningResult:
    code: str
    name: str
    market: str
    latest_price: float = 0
    change_pct: float = 0
    score: int = 0
    matched_bonuses: list[str] = field(default_factory=list)
    matched_penalties: list[str] = field(default_factory=list)
    evaluation: str = ""


class AgentOrchestrator:
    """策略编排 + 股票筛选引擎"""

    def __init__(self):
        if not strategy_loader.strategies:
            # Auto-load on first use
            from pathlib import Path
            default_dir = Path(__file__).parent.parent.parent / "strategies"
            strategy_loader.load(str(default_dir))

    def list_strategies(self) -> list[dict]:
        """Return all available strategies as dicts for API/display."""
        return [
            {
                "name": s.name,
                "aliases": s.aliases,
                "category": s.category,
                "description": s.description.split("\n")[0] if s.description else "",
                "risk_level": s.risk_level,
                "hold_period": s.hold_period,
            }
            for s in strategy_loader.strategies
        ]

    def find_strategy(self, query: str) -> Strategy | None:
        return strategy_loader.find(query) or (
            strategy_loader.search(query)[0] if strategy_loader.search(query) else None
        )

    async def screen(
        self, strategy_name: str, market: str = "CN", limit: int = 20
    ) -> list[ScreeningResult]:
        """Screen stocks in a market against a strategy. Returns ranked results."""
        strategy = self.find_strategy(strategy_name)
        if not strategy:
            return []

        if market == "CN":
            return await self._screen_cn(strategy, limit)
        elif market == "HK":
            return await self._screen_hk(strategy, limit)
        elif market == "US":
            return await self._screen_us(strategy, limit)
        return []

    async def _screen_cn(self, strategy: Strategy, limit: int) -> list[ScreeningResult]:
        from app.core.database import get_connection

        conn = get_connection()
        rows = conn.execute(
            "SELECT code, name, market, latest_price, change_pct, volume, amount, turnover "
            "FROM stock_list ORDER BY code ASC LIMIT 300"
        ).fetchall()
        conn.close()

        results: list[ScreeningResult] = []
        category = strategy.category

        for r in rows:
            score, bonuses, penalties = self._score_stock(
                strategy, category,
                price=r["latest_price"] or 0,
                volume=r["volume"] or 0,
                change_pct=r["change_pct"] or 0,
                turnover=r["turnover"] or 0,
            )
            if score >= 30:  # Lower threshold for broader screening
                results.append(ScreeningResult(
                    code=r["code"], name=r["name"], market=r["market"] or "CN",
                    latest_price=r["latest_price"] or 0,
                    change_pct=r["change_pct"] or 0,
                    score=score,
                    matched_bonuses=bonuses,
                    matched_penalties=penalties,
                    evaluation=f"策略: {strategy.name} | 得分: {score} | {strategy.hold_period}",
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    async def _screen_hk(self, strategy: Strategy, limit: int) -> list[ScreeningResult]:
        from app.core.database import get_connection

        conn = get_connection()
        rows = conn.execute(
            "SELECT code, name, market, latest_price, change_pct, volume, amount "
            "FROM stock_list_hk ORDER BY code ASC LIMIT 200"
        ).fetchall()
        conn.close()

        results: list[ScreeningResult] = []
        for r in rows:
            score, bonuses, penalties = self._score_stock(
                strategy, strategy.category,
                price=r["latest_price"] or 0,
                volume=r["volume"] or 0,
                change_pct=r["change_pct"] or 0,
            )
            if score >= 30:
                results.append(ScreeningResult(
                    code=r["code"], name=r["name"], market="HK",
                    latest_price=r["latest_price"] or 0,
                    change_pct=r["change_pct"] or 0,
                    score=score,
                    matched_bonuses=bonuses,
                    matched_penalties=penalties,
                    evaluation=f"策略: {strategy.name} | 得分: {score}",
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    async def _screen_us(self, strategy: Strategy, limit: int) -> list[ScreeningResult]:
        from app.core.database import get_connection

        conn = get_connection()
        rows = conn.execute(
            "SELECT code, name, market, latest_price, change_pct, volume, amount "
            "FROM stock_list_us ORDER BY code ASC LIMIT 200"
        ).fetchall()
        conn.close()

        results: list[ScreeningResult] = []
        for r in rows:
            score, bonuses, penalties = self._score_stock(
                strategy, strategy.category,
                price=r["latest_price"] or 0,
                volume=r["volume"] or 0,
                change_pct=r["change_pct"] or 0,
            )
            if score >= 30:
                results.append(ScreeningResult(
                    code=r["code"], name=r["name"], market="US",
                    latest_price=r["latest_price"] or 0,
                    change_pct=r["change_pct"] or 0,
                    score=score,
                    matched_bonuses=bonuses,
                    matched_penalties=penalties,
                    evaluation=f"策略: {strategy.name} | 得分: {score}",
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    def _score_stock(
        self, strategy: Strategy, category: str,
        price: float = 0, volume: float = 0,
        change_pct: float = 0, turnover: float = 0,
    ) -> tuple[int, list[str], list[str]]:
        """Apply strategy scoring rules to a stock. Returns (score, bonuses, penalties)."""
        score = strategy.base_score
        matched_bonuses: list[str] = []
        matched_penalties: list[str] = []

        # Category-based heuristics (simplified screening without full K-line analysis)
        if category == "trend_following":
            if change_pct > 2:
                score += 10
                matched_bonuses.append("涨幅>2%（趋势确认）")
            if change_pct > 5:
                score += 15
                matched_bonuses.append("涨幅>5%（强势）")
            if change_pct < -3:
                score -= 15
                matched_penalties.append("跌幅>3%（趋势破坏）")

        elif category == "reversal":
            if change_pct < -5:
                score += 10
                matched_bonuses.append("深度下跌（抄底机会）")
            if change_pct > 3 and price > 5:
                score += 15
                matched_bonuses.append("反弹确认（+3%）")
            if change_pct > 8:
                score -= 10  # 可能已经反弹到位
                matched_penalties.append("短期涨幅过大（追高风险）")

        elif category == "breakout":
            if change_pct > 3:
                score += 15
                matched_bonuses.append("突破信号（涨幅>3%）")
            if volume > 1e8:
                score += 10
                matched_bonuses.append("放量配合（成交>1亿）")
            if change_pct > 7:
                score += 20
                matched_bonuses.append("强势突破（涨幅>7%）")

        elif category == "mean_reversion":
            if abs(change_pct) < 2:
                score += 10
                matched_bonuses.append("窄幅波动（均值回归特性）")
            if change_pct < -1:
                score += 5
                matched_bonuses.append("小幅下跌（接近下沿）")
            if abs(change_pct) > 5:
                score -= 10
                matched_penalties.append("波动过大（箱体可能破位）")

        elif category == "momentum":
            if change_pct > 5:
                score += 20
                matched_bonuses.append("强势动量（涨幅>5%）")
            if turnover > 5:
                score += 10
                matched_bonuses.append("高换手率（资金关注）")
            if change_pct > 10:
                score -= 10
                matched_penalties.append("超买信号（追高风险）")

        elif category == "sentiment":
            score += 0  # Requires market-wide data, neutral for individual screening

        elif category == "event_driven":
            if abs(change_pct) > 3:
                score += 10
                matched_bonuses.append("显著异动（可能有事件驱动）")
            if volume > 5e7:
                score += 10
                matched_bonuses.append("成交活跃（事件影响中）")

        elif category == "fundamental":
            if price < 50:
                score += 5
                matched_bonuses.append("低价股（估值空间大）")
            if price > 100:
                score -= 5
                matched_penalties.append("高价股（估值可能偏高）")

        elif category == "technical":
            if change_pct > 2:
                score += 8
                matched_bonuses.append("技术信号偏多")

        # Volume-based adjustments (applicable to all)
        if volume > 5e8:
            score += 5
            matched_bonuses.append("高成交量（市场活跃）")
        if volume < 1e6 and volume > 0:
            score -= 5
            matched_penalties.append("成交低迷")

        # Clamp score
        score = max(0, min(100, score))
        return score, matched_bonuses, matched_penalties


# Global singleton
agent_orchestrator = AgentOrchestrator()
