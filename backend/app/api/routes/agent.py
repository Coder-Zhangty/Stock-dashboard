"""策略/Agent API — 策略查询 + 股票筛选"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.agent_orchestrator import agent_orchestrator

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.get("/strategies")
async def list_strategies():
    """Return all 15 trading strategies with metadata."""
    return {"data": agent_orchestrator.list_strategies()}


@router.get("/strategies/{name}")
async def get_strategy(name: str):
    """Get a single strategy by name."""
    s = agent_orchestrator.find_strategy(name)
    if not s:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Strategy '{name}' not found")
    return {
        "data": {
            "name": s.name,
            "aliases": s.aliases,
            "category": s.category,
            "description": s.description,
            "judgment_criteria": s.judgment_criteria,
            "base_score": s.base_score,
            "bonuses": s.bonuses,
            "penalties": s.penalties,
            "tools_required": s.tools_required,
            "risk_level": s.risk_level,
            "hold_period": s.hold_period,
        }
    }


@router.get("/screen")
async def screen_stocks(
    strategy: str = Query(..., description="Strategy name or alias"),
    market: str = Query("CN", description="Market: CN / HK / US"),
    limit: int = Query(20, ge=1, le=50),
):
    """Screen stocks matching a strategy. Returns ranked results with scores."""
    results = await agent_orchestrator.screen(strategy, market, limit)
    return {
        "strategy": strategy,
        "market": market,
        "count": len(results),
        "data": [
            {
                "code": r.code,
                "name": r.name,
                "market": r.market,
                "latest_price": r.latest_price,
                "change_pct": r.change_pct,
                "score": r.score,
                "matched_bonuses": r.matched_bonuses,
                "matched_penalties": r.matched_penalties,
                "evaluation": r.evaluation,
            }
            for r in results
        ],
    }
