from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class CreatePortfolioRequest(BaseModel):
    name: str = "My Portfolio"
    initial_capital: float = 0


class TransactionRequest(BaseModel):
    code: str
    name: str = ""
    tx_type: str = Field(..., pattern="^(buy|sell)$")
    quantity: int = Field(..., gt=0)
    price: float = Field(..., gt=0)
    fee: float = 0


class CashEntryRequest(BaseModel):
    type: str = Field(..., pattern="^(deposit|withdraw)$")
    amount: float
    description: str = ""


class CorporateActionRequest(BaseModel):
    code: str
    action_type: str = Field(..., pattern="^(dividend|split|rights_issue|spinoff)$")
    ex_date: str
    ratio: float = 0
    amount: float = 0
    notes: str = ""


@router.post("")
async def create_portfolio(body: CreatePortfolioRequest, request: Request):
    user = get_current_user(request)
    result = portfolio_service.create_portfolio(user["id"], body.name, body.initial_capital)
    return {"data": result}


@router.get("")
async def list_portfolios(request: Request):
    user = get_current_user(request)
    data = portfolio_service.get_portfolios(user["id"])
    return {"data": data}


@router.get("/{portfolio_id}")
async def get_portfolio(portfolio_id: int, request: Request):
    get_current_user(request)
    data = await portfolio_service.get_portfolio_summary(portfolio_id)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return {"data": data}


@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: int, request: Request):
    get_current_user(request)
    ok = portfolio_service.delete_portfolio(portfolio_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"data": {"deleted": True}}


@router.post("/{portfolio_id}/transaction")
async def add_transaction(portfolio_id: int, body: TransactionRequest, request: Request):
    get_current_user(request)
    result = portfolio_service.add_transaction(
        portfolio_id, body.code, body.name, body.tx_type,
        body.quantity, body.price, body.fee,
    )
    return {"data": result}


@router.get("/{portfolio_id}/transactions")
async def list_transactions(portfolio_id: int, limit: int = 50, request: Request = None):
    get_current_user(request)
    data = portfolio_service.get_transactions(portfolio_id, limit)
    return {"data": data}


# ── Cash Ledger ────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/ledger")
async def get_ledger(portfolio_id: int, limit: int = 100, request: Request = None):
    get_current_user(request)
    entries = portfolio_service.get_cash_ledger(portfolio_id, limit)
    summary = portfolio_service.get_cash_summary(portfolio_id)
    return {"data": {"entries": entries, "summary": summary}}


@router.post("/{portfolio_id}/ledger")
async def add_cash_entry(portfolio_id: int, body: CashEntryRequest, request: Request = None):
    get_current_user(request)
    multiplier = 1 if body.type == "deposit" else -1
    result = portfolio_service.record_cash_entry(
        portfolio_id, body.type, body.amount * multiplier, body.description,
    )
    return {"data": result}


# ── Corporate Actions ──────────────────────────────────────────────────────

@router.get("/{portfolio_id}/corporate-actions")
async def get_corp_actions(portfolio_id: int, request: Request = None):
    get_current_user(request)
    data = portfolio_service.get_corporate_actions(portfolio_id)
    return {"data": data}


@router.post("/{portfolio_id}/corporate-actions")
async def add_corp_action(portfolio_id: int, body: CorporateActionRequest, request: Request = None):
    get_current_user(request)
    result = portfolio_service.add_corporate_action(
        portfolio_id, body.code, body.action_type, body.ex_date,
        body.ratio, body.amount, body.notes,
    )
    return {"data": result}


# ── CSV Import ─────────────────────────────────────────────────────────────

@router.post("/{portfolio_id}/import")
async def import_csv(portfolio_id: int, file: UploadFile = File(...), request: Request = None):
    get_current_user(request)
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    result = portfolio_service.import_transactions_csv(portfolio_id, text)
    return {"data": result}


# ── Risk Reports ───────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/risk")
async def portfolio_risk(portfolio_id: int, request: Request = None):
    get_current_user(request)
    data = await portfolio_service.get_risk_report(portfolio_id)
    return {"data": data}


# ── NAV Snapshot ───────────────────────────────────────────────────────────

@router.post("/{portfolio_id}/snapshot")
async def take_nav_snapshot(portfolio_id: int, request: Request = None):
    get_current_user(request)
    result = portfolio_service.snapshot_nav(portfolio_id)
    return {"data": result}
