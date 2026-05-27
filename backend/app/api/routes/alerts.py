from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services import alert_service

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class CreateAlertRequest(BaseModel):
    name: str
    alert_type: str = Field(..., pattern="^(price|indicator|news|pnl|volume)$")
    code: str = ""
    market: str = "CN"
    condition_field: str = "latest_price"
    condition_op: str = Field(..., pattern="^(gt|lt|gte|lte|cross_above|cross_below|pct_change)$")
    condition_value: float = 0
    cooldown_minutes: int = 60
    notify_channels: str = ""


class UpdateAlertRequest(BaseModel):
    name: str | None = None
    alert_type: str | None = None
    code: str | None = None
    market: str | None = None
    condition_field: str | None = None
    condition_op: str | None = None
    condition_value: float | None = None
    enabled: int | None = None
    cooldown_minutes: int | None = None
    notify_channels: str | None = None


@router.get("")
async def list_rules(request: Request):
    user = get_current_user(request)
    data = alert_service.get_rules(user["id"])
    return {"data": data}


@router.post("")
async def create_rule(body: CreateAlertRequest, request: Request):
    user = get_current_user(request)
    result = alert_service.create_rule(
        user["id"], body.name, body.alert_type, body.code, body.market,
        body.condition_field, body.condition_op, body.condition_value,
        body.cooldown_minutes, body.notify_channels,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"data": result}


@router.put("/{rule_id}")
async def update_rule(rule_id: int, body: UpdateAlertRequest, request: Request):
    user = get_current_user(request)
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    result = alert_service.update_rule(rule_id, user["id"], **fields)
    if result.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"data": result}


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, request: Request):
    user = get_current_user(request)
    ok = alert_service.delete_rule(rule_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"data": {"deleted": True}}


@router.get("/history")
async def alert_history(limit: int = 50, request: Request = None):
    user = get_current_user(request)
    data = alert_service.get_alert_history(user["id"], limit)
    return {"data": data}
