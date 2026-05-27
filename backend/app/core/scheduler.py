from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.services import news_service, market_service

logger = logging.getLogger(__name__)

BEIJING_TZ = timezone(timedelta(hours=8))

scheduler = AsyncIOScheduler(timezone=BEIJING_TZ)


def _run_async_report(coro_name):
    """Wrap async report generation for APScheduler, with push notification."""
    def wrapper():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            from app.services import report_service
            from app.services.notification_service import get_notification_service
            coro = getattr(report_service, coro_name)
            result = loop.run_until_complete(coro())
            if result.get("status") == "generated":
                ns = get_notification_service()
                loop.run_until_complete(
                    ns.broadcast(result["title"], result["content"])
                )
            loop.close()
        except Exception as exc:
            logger.error("Report generation '%s' failed: %s", coro_name, exc)
    return wrapper


def init_scheduler():
    # Refresh all news sources every 3 minutes
    scheduler.add_job(
        news_service.refresh_news,
        IntervalTrigger(minutes=3),
        id="refresh_news",
        name="Refresh financial news (all sources)",
        replace_existing=True,
        max_instances=1,
    )

    # ── Market data refresh ──
    # Individual stock prices are refreshed on-demand per page via get_spot_list
    # background tasks (async per-page batch_quotes). No full-list refresh needed.

    # Refresh news AI summary every 10 minutes
    scheduler.add_job(
        news_service.refresh_news_summary,
        IntervalTrigger(minutes=10),
        id="refresh_news_summary",
        name="Refresh AI news summary",
        replace_existing=True,
        max_instances=1,
    )

    # Pre-market: fetch news at 9:25 AM on trading days (Mon-Fri)
    scheduler.add_job(
        news_service.refresh_news,
        CronTrigger(day_of_week="mon-fri", hour=9, minute=25),
        id="pre_market_news",
        name="Pre-market news fetch (all sources)",
        replace_existing=True,
        max_instances=1,
    )

    # Pre-market brief: 9:15 AM Mon-Fri
    scheduler.add_job(
        _run_async_report("generate_pre_market_brief"),
        CronTrigger(day_of_week="mon-fri", hour=9, minute=15),
        id="pre_market_brief",
        name="Generate pre-market brief",
        replace_existing=True,
        max_instances=1,
    )

    # Daily market report: 15:30 PM Mon-Fri (after market close)
    scheduler.add_job(
        _run_async_report("generate_daily_report"),
        CronTrigger(day_of_week="mon-fri", hour=15, minute=30),
        id="daily_report",
        name="Generate daily market report",
        replace_existing=True,
        max_instances=1,
    )

    # Weekly report: 16:00 Friday
    scheduler.add_job(
        _run_async_report("generate_weekly_report"),
        CronTrigger(day_of_week="fri", hour=16, minute=0),
        id="weekly_report",
        name="Generate weekly market summary",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info(
        "Scheduler started: news every 3min, pre-market 9:15/9:25, "
        "daily report 15:30, weekly report Fri 16:00"
    )


def shutdown_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler shutdown")
