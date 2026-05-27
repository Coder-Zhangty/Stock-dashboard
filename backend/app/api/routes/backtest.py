from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services import backtest_service

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


class RecordPredictionRequest(BaseModel):
    code: str
    name: str = ""
    market: str = "CN"
    direction: str = Field(..., pattern="^(bullish|bearish|neutral)$")
    confidence: int = Field(..., ge=1, le=100)
    price_at_analysis: float = Field(..., gt=0)
    target_price: float = 0
    stop_loss: float = 0
    analysis_json: str = ""


@router.post("/record")
async def record_prediction(body: RecordPredictionRequest, request: Request):
    user = get_current_user(request)
    result = backtest_service.record_prediction(
        user["id"], body.code, body.name, body.market,
        body.direction, body.confidence, body.price_at_analysis,
        body.target_price, body.stop_loss, body.analysis_json,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"data": result}


@router.post("/evaluate")
async def evaluate_predictions(
    request: Request,
    min_age_days: int = 5,
    all_users: bool = False,
):
    user = get_current_user(request)
    uid = None if (all_users and user.get("is_admin")) else user["id"]
    result = backtest_service.evaluate_predictions(uid, min_age_days)
    return {"data": result}


@router.get("/summary")
async def backtest_summary(request: Request, all_users: bool = False):
    user = get_current_user(request)
    uid = None if (all_users and user.get("is_admin")) else user["id"]
    result = backtest_service.get_backtest_summary(uid)
    return {"data": result}


@router.get("/pending")
async def pending_count(request: Request):
    get_current_user(request)
    count = backtest_service.get_pending_count()
    return {"data": {"pending": count}}
