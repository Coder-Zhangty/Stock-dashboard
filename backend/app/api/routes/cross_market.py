from __future__ import annotations

from fastapi import APIRouter, Query

from app.services import hk_market_service, us_market_service

router = APIRouter(prefix="/api/market", tags=["cross-market"])


@router.get("/hk/spot")
async def hk_spot_list(
    page: int = 1,
    page_size: int = 100,
    sort_by: str = "",
    sort_order: str = "desc",
    price_min: float | None = None,
    price_max: float | None = None,
    change_min: float | None = None,
    change_max: float | None = None,
    volume_min: float | None = None,
):
    """HK stock spot list from DB cache with pagination and sorting."""
    filters = {
        "price_min": price_min, "price_max": price_max,
        "change_min": change_min, "change_max": change_max,
        "volume_min": volume_min,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    return await hk_market_service.get_hk_spot_list(page, page_size, sort_by, sort_order, filters)


@router.get("/us/spot")
async def us_spot_list(
    page: int = 1,
    page_size: int = 100,
    sort_by: str = "",
    sort_order: str = "desc",
    price_min: float | None = None,
    price_max: float | None = None,
    change_min: float | None = None,
    change_max: float | None = None,
    volume_min: float | None = None,
):
    """US stock spot list from DB cache with pagination and sorting."""
    filters = {
        "price_min": price_min, "price_max": price_max,
        "change_min": change_min, "change_max": change_max,
        "volume_min": volume_min,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    return await us_market_service.get_us_spot_list(page, page_size, sort_by, sort_order, filters)


@router.get("/hk/quote/{code}")
async def hk_quote(code: str):
    quote = await hk_market_service.get_hk_quote(code)
    if quote is None:
        return {"error": "Failed to fetch HK quote"}
    return {"data": quote}


@router.get("/hk/batch")
async def hk_batch(codes: str = Query("", description="Comma-separated codes")):
    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    if not code_list:
        return {"data": {}}
    quotes = await hk_market_service.batch_hk_quotes(code_list)
    return {"data": quotes}


@router.get("/hk/indices")
async def hk_indices():
    return {"data": await hk_market_service.get_hk_indices()}


@router.get("/hk/popular")
async def hk_popular():
    return {"data": await hk_market_service.get_hk_popular()}


@router.get("/hk/kline/{code}")
async def hk_kline(code: str, period: str = "daily", count: int = 120):
    """HK stock K-line data (daily/weekly/monthly) with indicators."""
    from app.services.indicators import attach_all_indicators

    data = await hk_market_service.get_hk_kline(code, period, count)
    attach_all_indicators(data)
    return {"data": data}


@router.get("/us/quote/{symbol}")
async def us_quote(symbol: str):
    from app.services import us_market_service as us_svc
    quote = await us_svc._yfinance_quote(symbol)
    if quote is None:
        return {"error": "Failed to fetch US quote"}
    return {"data": quote}


@router.get("/us/batch")
async def us_batch(symbols: str = Query("", description="Comma-separated symbols")):
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        return {"data": {}}
    quotes = await us_market_service.batch_us_quotes(sym_list)
    return {"data": quotes}


@router.get("/us/indices")
async def us_indices():
    return {"data": await us_market_service.get_us_indices()}


@router.get("/us/popular")
async def us_popular():
    return {"data": await us_market_service.get_us_popular()}


@router.get("/us/kline/{symbol}")
async def us_kline(symbol: str, period: str = "daily", count: int = 120):
    """US stock K-line data (daily/weekly/monthly) with indicators."""
    from app.services.indicators import attach_all_indicators

    data = await us_market_service.get_us_kline(symbol, period, count)
    attach_all_indicators(data)
    return {"data": data}
