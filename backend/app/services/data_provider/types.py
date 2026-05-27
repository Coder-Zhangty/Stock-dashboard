"""统一数据模型 — 屏蔽不同数据源差异"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class QuoteField(StrEnum):
    """报价字段枚举，方便按需取字段"""
    CODE = "code"
    NAME = "name"
    LATEST_PRICE = "latest_price"
    PREV_CLOSE = "prev_close"
    OPEN = "open"
    HIGH = "high"
    LOW = "low"
    VOLUME = "volume"
    AMOUNT = "amount"
    CHANGE_PCT = "change_pct"
    CHANGE_AMOUNT = "change_amount"
    TURNOVER = "turnover"
    TURNOVER_RATE = "turnover_rate"
    AMPLITUDE = "amplitude"
    PE = "pe"
    PB = "pb"
    MARKET_CAP = "market_cap"
    HIGH_52W = "high_52w"
    LOW_52W = "low_52w"
    CURRENCY = "currency"
    MARKET = "market"


@dataclass
class UnifiedQuote:
    """统一实时报价模型"""
    code: str
    name: str = ""
    market: str = ""          # CN/HK/US
    latest_price: float = 0
    prev_close: float = 0
    change_pct: float = 0
    change_amount: float = 0
    open: float = 0
    high: float = 0
    low: float = 0
    volume: float = 0
    amount: float = 0
    turnover: float = 0
    turnover_rate: float = 0
    amplitude: float = 0
    pe: float = 0
    pb: float = 0
    market_cap: float = 0
    high_52w: float = 0
    low_52w: float = 0
    currency: str = ""
    # Source metadata
    source: str = ""
    snapshot_at: float = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "market": self.market,
            "latest_price": round(self.latest_price, 2),
            "prev_close": round(self.prev_close, 2),
            "change_pct": round(self.change_pct, 2),
            "change_amount": round(self.change_amount, 2),
            "open": round(self.open, 2),
            "high": round(self.high, 2),
            "low": round(self.low, 2),
            "volume": self.volume,
            "amount": self.amount,
            "turnover": self.turnover,
            "turnover_rate": self.turnover_rate,
            "amplitude": self.amplitude,
            "pe": self.pe,
            "pb": self.pb,
            "market_cap": self.market_cap,
            "high_52w": self.high_52w,
            "low_52w": self.low_52w,
            "currency": self.currency,
        }


@dataclass
class UnifiedKline:
    """统一K线数据模型"""
    code: str
    trade_date: str           # YYYY-MM-DD
    open: float = 0
    close: float = 0
    high: float = 0
    low: float = 0
    volume: float = 0
    amount: float = 0
    turnover: float = 0
    source: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "trade_date": self.trade_date,
            "open": round(self.open, 2),
            "close": round(self.close, 2),
            "high": round(self.high, 2),
            "low": round(self.low, 2),
            "volume": self.volume,
            "amount": self.amount,
        }
