from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.services import market_service
from app.api.deps import rate_limit

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/spot")
async def spot_list(
    page: int = 1,
    page_size: int = 100,
    sort_by: str = "",
    sort_order: str = "desc",
    _: None = rate_limit(max_requests=30, window_seconds=5),
    price_min: float | None = None,
    price_max: float | None = None,
    change_min: float | None = None,
    change_max: float | None = None,
    volume_min: float | None = None,
    turnover_min: float | None = None,
    turnover_max: float | None = None,
    volume_ratio_min: float | None = None,
    volume_ratio_max: float | None = None,
    pe_min: float | None = None,
    pe_max: float | None = None,
    pb_min: float | None = None,
    pb_max: float | None = None,
    amplitude_min: float | None = None,
    amplitude_max: float | None = None,
    mcap_min: float | None = None,
    mcap_max: float | None = None,
):
    """A-share spot market overview with pagination, sorting, and filtering."""
    filters = {
        "price_min": price_min, "price_max": price_max,
        "change_min": change_min, "change_max": change_max,
        "volume_min": volume_min,
        "turnover_min": turnover_min, "turnover_max": turnover_max,
        "volume_ratio_min": volume_ratio_min, "volume_ratio_max": volume_ratio_max,
        "pe_min": pe_min, "pe_max": pe_max,
        "pb_min": pb_min, "pb_max": pb_max,
        "amplitude_min": amplitude_min, "amplitude_max": amplitude_max,
        "mcap_min": mcap_min, "mcap_max": mcap_max,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    return await market_service.get_spot_list(page, page_size, sort_by, sort_order, filters)


@router.get("/quote/{code}")
async def stock_quote(code: str, market: str = "SH"):
    """Real-time quote for a single stock."""
    return await market_service.get_stock_quote(code, market)


@router.get("/kline/{code}")
async def kline(code: str, period: str = "daily", count: int = 120):
    """Historical K-line with MA, MACD, KDJ, RSI, BOLL indicators."""
    from app.services.indicators import attach_all_indicators

    data = await market_service.get_kline(code, period, count)
    attach_all_indicators(data)
    return {"code": code, "count": len(data), "data": data}


@router.get("/batch")
async def batch_quotes(
    codes: str = Query(...),
    _: None = rate_limit(max_requests=10, window_seconds=5),
):
    """Batch fetch quotes for multiple codes (comma-separated)."""
    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    return await market_service.batch_quotes(code_list)


@router.get("/index")
async def market_index():
    """Major indices: 上证, 深证, 创业板."""
    return await market_service.get_indices()


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    _: None = rate_limit(max_requests=20, window_seconds=5),
):
    """Search stocks by code or name."""
    return await market_service.search_stock(q)


@router.get("/minute/{code}")
async def minute_line(code: str):
    """Intraday minute-level data for time-sharing chart."""
    return await market_service.get_minute_line(code)


@router.get("/brief/{code}")
async def stock_brief(code: str):
    """Fundamental data (PE, PB, market cap, etc.)."""
    return await market_service.get_stock_brief(code)


@router.get("/breadth")
async def market_breadth():
    """Market breadth: count of rising/falling/flat stocks."""
    return await market_service.get_market_breadth()


@router.get("/sectors")
async def sectors(type: str = "industry"):
    """Industry or concept sector board."""
    return await market_service.fetch_sectors(type)


@router.get("/fundflow/{code}")
async def fund_flow(code: str, days: int = 30):
    """Fund flow data: main force / super large / large / medium / small net inflow."""
    return await market_service.get_fund_flow(code, days)


@router.get("/market-turnover")
async def market_turnover():
    """Total turnover for Shanghai + Shenzhen exchanges."""
    return await market_service.get_market_turnover()


@router.get("/northbound")
async def northbound_flow():
    """北向资金 net inflow (沪股通 + 深股通)."""
    return await market_service.get_northbound_flow()


@router.get("/cyq/{code}")
async def chip_distribution(code: str, period: str = "daily"):
    """Chip distribution (CYQ) — price-bucket histogram for drawing chip peak overlay on K-line chart."""
    result = await market_service.calculate_cyq(code, period)
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="无法计算该股票的筹码分布（数据不足）")
    return result


@router.get("/providers/health")
async def providers_health():
    """Multi-source data provider health status — circuit breaker states, failure counts."""
    from app.services.data_provider import data_provider
    return {"data": data_provider.health_summary()}
