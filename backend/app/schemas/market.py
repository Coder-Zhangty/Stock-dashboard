from __future__ import annotations

from pydantic import BaseModel


class StockQuote(BaseModel):
    code: str
    name: str
    market: str
    latest_price: float
    change_pct: float
    change_amount: float
    open: float
    high: float
    low: float
    volume: float
    amount: float
    turnover: float


class KLineItem(BaseModel):
    trade_date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


class StockBrief(BaseModel):
    code: str
    name: str
    market: str
    industry: str = ""
    market_cap: float = 0
    pe_ratio: float = 0
    pb_ratio: float = 0


class NewsItem(BaseModel):
    id: int
    source: str
    title: str
    url: str
    content: str = ""
    related_code: str = ""
    sentiment: str = ""
    published_at: str


class WatchlistItem(BaseModel):
    id: int
    code: str
    name: str
    market: str
    added_at: str
    notes: str
