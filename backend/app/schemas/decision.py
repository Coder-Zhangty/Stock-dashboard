"""AI 决策看板数据模型"""

from __future__ import annotations

from pydantic import BaseModel, Field


class CoreConclusion(BaseModel):
    direction: str = Field(..., description="bullish / bearish / neutral")
    confidence: int = Field(..., ge=0, le=100, description="信心评分 0-100")
    summary: str = Field(..., description="一句话核心判断")


class PricePosition(BaseModel):
    current: float = 0
    support: float = 0       # 支撑位
    resistance: float = 0    # 阻力位
    pct_to_support: float = 0
    pct_to_resistance: float = 0
    description: str = ""


class TrendState(BaseModel):
    direction: str = ""       # upward / downward / sideways
    ma_arrangement: str = ""  # 多头排列 / 空头排列 / 交织
    strength: str = ""        # 强势 / 弱势 / 中性
    description: str = ""


class VolumeAnalysis(BaseModel):
    status: str = ""          # 放量 / 缩量 / 正常
    volume_ratio: float = 0   # 量比
    price_volume_relation: str = ""  # 价涨量增 / 价跌量缩 等
    description: str = ""


class DataPerspective(BaseModel):
    trend: TrendState = Field(default_factory=TrendState)
    price_position: PricePosition = Field(default_factory=PricePosition)
    volume: VolumeAnalysis = Field(default_factory=VolumeAnalysis)


class IntelligenceItem(BaseModel):
    title: str = ""
    source: str = ""
    time: str = ""
    sentiment: str = ""  # positive / negative / neutral


class MarketIntelligence(BaseModel):
    news_summary: str = ""
    risk_alerts: list[str] = Field(default_factory=list)
    catalysts: list[str] = Field(default_factory=list)
    recent_news: list[IntelligenceItem] = Field(default_factory=list)


class BattlePlan(BaseModel):
    buy_point: float = 0       # 理想买入价
    sell_point: float = 0      # 目标卖出价
    stop_loss: float = 0       # 止损价
    position_advice: str = ""  # 仓位建议
    position_pct: int = 0      # 建议仓位百分比
    action_items: list[str] = Field(default_factory=list)


class DecisionDashboard(BaseModel):
    code: str
    name: str = ""
    market: str = ""
    generated_at: str = ""
    price_at_analysis: float = 0
    core_conclusion: CoreConclusion
    data_perspective: DataPerspective = Field(default_factory=DataPerspective)
    intelligence: MarketIntelligence = Field(default_factory=MarketIntelligence)
    battle_plan: BattlePlan = Field(default_factory=BattlePlan)


class AnalysisRequest(BaseModel):
    code: str
    market: str = ""  # CN / HK / US, auto-detect if empty
