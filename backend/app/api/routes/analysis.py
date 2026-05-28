"""AI 分析决策看板 API"""

from __future__ import annotations

import re
from fastapi import APIRouter

from app.schemas.decision import DecisionDashboard
from app.services.analysis_service import collect_stock_data, call_llm_for_analysis, _fallback_analysis

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _detect_market(code: str) -> str:
    """Detect market from stock code format.

    A-shares: 6-digit numeric (600000, 000001, 300750)
    HK stocks: 4-5 digit numeric (00700, 09988, 00001)
    US stocks: alphabetic ticker (AAPL, TSLA, BRK.B)
    """
    if not code:
        return "CN"
    if re.match(r"^[A-Za-z.]+$", code):
        return "US"
    if re.match(r"^\d{4,5}$", code):
        return "HK"
    return "CN"


@router.get("/stock/{code}", response_model=DecisionDashboard)
async def analyze_stock(code: str, market: str = "", fast: bool = False):
    mkt = market if market else _detect_market(code)
    data = await collect_stock_data(code, mkt)
    if fast:
        return _fallback_analysis(data)
    return await call_llm_for_analysis(data)
