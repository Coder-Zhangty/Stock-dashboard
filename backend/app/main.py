from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.core.logging_config import setup_logging
from app.core.scheduler import init_scheduler, shutdown_scheduler
from app.api.routes import market, news, watchlist, ws as ws_routes
from app.api.routes import cross_market, portfolio, analysis, agent, backtest, alerts
from app.api.routes import auth, chat, conversations, library, workspace, security, admin as admin_routes
from app.services import market_service, hk_market_service, us_market_service
from app.services.ws_manager import ws_manager

setup_logging("INFO")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runtime security validation
    settings.validate_runtime()

    # Init database (all tables)
    init_db()
    logger.info("Database initialized")

    # Init data provider framework (multi-source with circuit breakers)
    from app.services.data_provider import init_providers
    init_providers()
    logger.info("Data providers initialized")

    # Load trading strategies
    from app.services.strategy_loader import strategy_loader
    from pathlib import Path
    strategies_dir = Path(__file__).parent.parent / "strategies"
    strategy_loader.load(str(strategies_dir))
    logger.info("Trading strategies loaded: %d", len(strategy_loader.strategies))

    # Seed admin user & chat data
    from app.services.auth_service import AuthService
    from app.services.provider_registry_service import ProviderRegistryService
    from app.services.user_governance_service import UserGovernanceService

    try:
        AuthService(settings).ensure_seed_admin()
        ProviderRegistryService(settings).ensure_seed_data()
        UserGovernanceService(settings).migrate_legacy_inherited_model_access()
        logger.info("Chat services seeded")
    except Exception as e:
        logger.warning("Chat seed skipped (may be first run): %s", e)

    # Scheduler for news refresh
    init_scheduler()
    logger.info("Scheduler initialized")

    # Initialize stock lists in background
    asyncio.create_task(_init_stock_list_bg())

    # Start alert checker worker
    from app.services.alert_service import start_alert_worker
    start_alert_worker(60)
    logger.info("Alert worker started")

    yield

    from app.services.alert_service import stop_alert_worker
    stop_alert_worker()
    await ws_manager.shutdown()
    shutdown_scheduler()


async def _init_stock_list_bg():
    # A-share
    try:
        count = await market_service.init_stock_list()
        logger.info("Stock list ready: %s stocks", count)
    except Exception as e:
        logger.error("Stock list init failed: %s", e)

    # HK stock list
    try:
        count = await hk_market_service.refresh_hk_stock_list()
        logger.info("HK stock list ready: %s new stocks", count)
    except Exception as e:
        logger.error("HK stock list init failed: %s", e)

    # US stock list
    try:
        count = await us_market_service.refresh_us_stock_list()
        logger.info("US stock list ready: %s new stocks", count)
    except Exception as e:
        logger.error("US stock list init failed: %s", e)


app = FastAPI(title="Trade Dashboard", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Market routes (already prefixed with /api/...)
app.include_router(market.router)
app.include_router(news.router)
app.include_router(watchlist.router)
app.include_router(ws_routes.router)
app.include_router(cross_market.router)
app.include_router(portfolio.router)
app.include_router(analysis.router)
app.include_router(agent.router)
app.include_router(backtest.router)
app.include_router(alerts.router)

# Chat / Auth routes (prefixed with /api here)
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(conversations.router, prefix="/api", tags=["conversations"])
app.include_router(library.router, prefix="/api", tags=["library"])
app.include_router(workspace.router, prefix="/api", tags=["workspace"])
app.include_router(security.router, prefix="/api", tags=["security"])
app.include_router(admin_routes.router, prefix="/api", tags=["admin"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "trade-dashboard"}
