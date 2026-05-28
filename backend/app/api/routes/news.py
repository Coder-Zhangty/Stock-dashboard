from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.services import news_service, news_reader, report_service
from app.services.report_generator import generate_html_report

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/latest")
async def latest_news(
    limit: int = 50,
    offset: int = 0,

):
    return await news_service.get_all_news(limit, offset)


@router.post("/refresh")
async def refresh_news(

):
    return await news_service.refresh_news()


@router.get("/search")
async def search_news(q: str):
    return await news_service.search_news_for_stock(q)


@router.get("/summary")
async def news_summary():
    """AI-generated market news summary (cached, 10-min TTL)."""
    return await news_service.get_news_summary()


@router.post("/summary/refresh")
async def refresh_summary(

):
    """Manually trigger a news summary refresh."""
    return await news_service.refresh_news_summary()


@router.get("/summary/enabled")
async def summary_enabled():
    """Check if news summary is enabled."""
    return {"enabled": news_service.get_news_summary_enabled()}


@router.post("/summary/enabled")
async def toggle_summary(payload: dict):
    """Enable or disable the news summary feature."""
    enabled = payload.get("enabled", True)
    news_service.set_news_summary_enabled(enabled)
    return {"enabled": enabled}


@router.get("/sentiment/{code}")
async def stock_sentiment(code: str, name: str = ""):
    """AI sentiment analysis for a stock's related news."""
    return await news_service.get_stock_sentiment(code, name)



@router.get("/proxy")
async def proxy_news(url: str = Query(..., description="News article URL")):
    """Fetch a news page and return modified HTML suitable for iframe embedding."""
    try:
        html = await news_reader.fetch_and_proxy(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"代理请求失败: {e}")
    return HTMLResponse(content=html, status_code=200)


@router.get("/extract")
async def extract_news(url: str = Query(..., description="News article URL")):
    """Extract article content (title + cleaned body HTML) from a news page."""
    try:
        result = await news_reader.extract_content(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"内容提取失败: {e}")
    return result


# ── Reports ──

@router.get("/reports")
async def list_reports(type: str | None = None, limit: int = 20):
    """List recent market reports, optionally filtered by type (daily/weekly/pre_market)."""
    return report_service.list_reports(type, limit)


@router.get("/reports/latest")
async def latest_report(type: str = "daily"):
    """Get the latest report of a given type."""
    report = report_service.get_latest_report(type)
    if not report:
        raise HTTPException(status_code=404, detail="No report found")
    return report


@router.post("/reports/generate")
async def generate_report(
    type: str = "daily",

):
    """Manually trigger a report generation."""
    if type == "daily":
        result = await report_service.generate_daily_report()
    elif type == "pre_market":
        result = await report_service.generate_pre_market_brief()
    elif type == "weekly":
        result = await report_service.generate_weekly_report()
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")
    return result


@router.get("/reports/html", response_class=HTMLResponse)
async def report_html(type: str = "daily"):
    """Get a printable HTML market report."""
    html = await generate_html_report(type)
    return html
