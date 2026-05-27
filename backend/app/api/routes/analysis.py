"""AI 分析决策看板 API"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.decision import DecisionDashboard
from app.services.analysis_service import collect_stock_data, call_llm_for_analysis, _fallback_analysis

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _detect_market(code: str) -> str:
    if code and code[0].isalpha():
        return "US"
    if code and len(code) == 5 and code.startswith("0"):
        return "HK"
    return "CN"


@router.get("/stock/{code}", response_model=DecisionDashboard)
async def analyze_stock(code: str, market: str = "", fast: bool = False):
    """AI 驱动的个股决策分析看板。

    - `fast=true`: 跳过 LLM，仅返回基于技术指标的量化分析（秒级响应）
    - `fast=false`: 调用 AI 模型生成完整分析（20-60秒）
    """
    mkt = market if market else _detect_market(code)
    data = await collect_stock_data(code, mkt)
    if fast:
        return _fallback_analysis(data)
    return await call_llm_for_analysis(data)
