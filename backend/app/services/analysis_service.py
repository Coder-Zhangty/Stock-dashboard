"""AI 驱动的个股分析引擎 — 生成结构化决策看板"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.schemas.decision import (
    DecisionDashboard, CoreConclusion, DataPerspective,
    TrendState, PricePosition, VolumeAnalysis,
    MarketIntelligence, IntelligenceItem, BattlePlan,
)

logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM_PROMPT = """你是一名专业的量化交易分析师。根据提供的股票数据进行客观分析，输出一个严格的 JSON 决策看板。

## 输出格式要求
必须返回有效的 JSON，结构如下：
```json
{
  "core_conclusion": {
    "direction": "bullish / bearish / neutral",
    "confidence": 0-100,
    "summary": "一句话核心判断"
  },
  "data_perspective": {
    "trend": {
      "direction": "upward / downward / sideways",
      "ma_arrangement": "多头排列 / 空头排列 / 交织",
      "strength": "强势 / 弱势 / 中性",
      "description": "趋势分析说明"
    },
    "price_position": {
      "support": 支撑位价格,
      "resistance": 阻力位价格,
      "pct_to_support": 距支撑位百分比,
      "pct_to_resistance": 距阻力位百分比,
      "description": "位置分析说明"
    },
    "volume": {
      "status": "放量 / 缩量 / 正常",
      "volume_ratio": 量比(若无填0),
      "price_volume_relation": "价涨量增 / 价涨量缩 / 价跌量增 / 价跌量缩 / 正常 / --",
      "description": "量能分析说明"
    }
  },
  "intelligence": {
    "news_summary": "近期新闻综评(50字内)",
    "risk_alerts": ["风险1", "风险2"],
    "catalysts": ["催化剂1", "催化剂2"]
  },
  "battle_plan": {
    "buy_point": 理想买入价,
    "sell_point": 目标卖出价,
    "stop_loss": 建议止损价,
    "position_advice": "仓位建议说明",
    "position_pct": 建议仓位百分比(0-100),
    "action_items": ["行动1", "行动2"]
  }
}
```

## 分析原则
1. 基于提供的数据进行量化分析，不凭空猜测
2. confidence 评分要客观：60+ 表示明确信号，80+ 表示多个指标共振
3. support/resistance 基于 MA 均线、BOLL 轨道、近期高低点
4. position_pct 保守给 10-30%，激进给 30-50%
5. 如数据不足以支撑某个判断，明确在 description 中说明
6. 只做分析，不构成投资建议"""


async def collect_stock_data(code: str, market: str) -> dict:
    """Collect all available data for a stock across multiple services."""
    data = {"code": code, "market": market, "indicators": {}, "quote": None,
            "news": [], "brief": {}}

    try:
        if market == "CN":
            from app.services import market_service
            data["quote"] = await market_service.get_stock_quote(code)
            klines = await market_service.get_kline(code, "daily", 60)
            data["kline_count"] = len(klines)
            if klines:
                closes = [k["close"] for k in klines]
                data["indicators"]["latest_close"] = closes[-1]
                data["indicators"]["ma5"] = round(sum(closes[-5:]) / 5, 2) if len(closes) >= 5 else 0
                data["indicators"]["ma10"] = round(sum(closes[-10:]) / 10, 2) if len(closes) >= 10 else 0
                data["indicators"]["ma20"] = round(sum(closes[-20:]) / 20, 2) if len(closes) >= 20 else 0
                data["indicators"]["ma60"] = round(sum(closes[-60:]) / 60, 2) if len(closes) >= 60 else 0
            brief = await market_service.get_stock_brief(code)
            data["brief"] = brief
        elif market == "HK":
            from app.services import hk_market_service
            data["quote"] = await hk_market_service.get_hk_quote(code)
            klines = await hk_market_service.get_hk_kline(code, "daily", 60)
            if klines:
                closes = [k["close"] for k in klines]
                data["indicators"]["latest_close"] = closes[-1] if closes else 0
                data["indicators"]["ma5"] = round(sum(closes[-5:]) / 5, 2) if len(closes) >= 5 else 0
                data["indicators"]["ma10"] = round(sum(closes[-10:]) / 10, 2) if len(closes) >= 10 else 0
                data["indicators"]["ma20"] = round(sum(closes[-20:]) / 20, 2) if len(closes) >= 20 else 0
                data["indicators"]["ma60"] = round(sum(closes[-60:]) / 60, 2) if len(closes) >= 60 else 0
            data["kline_count"] = len(klines)
        elif market == "US":
            from app.services import us_market_service
            data["quote"] = await us_market_service._yfinance_quote(code)
            klines = await us_market_service.get_us_kline(code, "daily", 60)
            if klines:
                closes = [k["close"] for k in klines]
                data["indicators"]["latest_close"] = closes[-1] if closes else 0
                data["indicators"]["ma5"] = round(sum(closes[-5:]) / 5, 2) if len(closes) >= 5 else 0
                data["indicators"]["ma10"] = round(sum(closes[-10:]) / 10, 2) if len(closes) >= 10 else 0
                data["indicators"]["ma20"] = round(sum(closes[-20:]) / 20, 2) if len(closes) >= 20 else 0
                data["indicators"]["ma60"] = round(sum(closes[-60:]) / 60, 2) if len(closes) >= 60 else 0
            data["kline_count"] = len(klines)
    except Exception as e:
        logger.warning("Data collection partial error for %s: %s", code, e)

    # Recent news
    try:
        from app.services import news_service as ns
        from app.core.database import get_connection
        conn = get_connection()
        rows = conn.execute(
            "SELECT title, source, published_at FROM news_articles ORDER BY published_at DESC LIMIT 20"
        ).fetchall()
        conn.close()
        data["news"] = [
            {"title": r["title"], "source": r["source"], "time": str(r["published_at"])}
            for r in rows
        ][:5]
    except Exception:
        pass

    return data


async def call_llm_for_analysis(data: dict) -> DecisionDashboard:
    """Call LLM with stock data, parse structured JSON response."""
    from app.core.config import settings
    import httpx

    quote = data.get("quote") or {}
    name = quote.get("name", data.get("code", ""))
    price = quote.get("latest_price", 0)

    user_prompt = f"""
## 股票信息
- 代码: {data['code']}
- 名称: {name}
- 市场: {data['market']}
- 最新价: {price}
- 前收盘: {quote.get('prev_close', 0)}
- 今日开盘: {quote.get('open', 0)}
- 今日最高: {quote.get('high', 0)}
- 今日最低: {quote.get('low', 0)}
- 成交量: {quote.get('volume', 0)}
- 成交额: {quote.get('amount', 0)}

## 技术指标 (近{data.get('kline_count', 0)}日K线)
{json.dumps(data.get('indicators', {}), ensure_ascii=False)}

## 基本面
{json.dumps(data.get('brief', {}), ensure_ascii=False)}

## 近期新闻
{json.dumps(data.get('news', [])[:5], ensure_ascii=False)}

请根据以上数据，生成完整的 JSON 决策看板。只输出 JSON，不要其他内容。"""

    api_url = getattr(settings, 'openai_base_url', 'https://api.deepseek.com/v1')
    api_key = getattr(settings, 'openai_api_key', getattr(settings, 'deepseek_api_key', ''))
    model = getattr(settings, 'chat_model', 'deepseek-chat')

    if not api_key:
        return _fallback_analysis(data)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{api_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            content = result["choices"][0]["message"]["content"]
            return _parse_llm_response(content, data)
    except Exception as e:
        logger.warning("LLM analysis failed for %s: %s — using fallback", data["code"], e)
        return _fallback_analysis(data)


def _parse_llm_response(content: str, data: dict) -> DecisionDashboard:
    """Parse LLM JSON response, with fallback on parse error."""
    try:
        # Strip markdown code fences
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        raw = json.loads(content)
        return DecisionDashboard(
            code=data["code"],
            name=(data.get("quote") or {}).get("name", "") or "",
            market=data.get("market", ""),
            generated_at=datetime.now(timezone.utc).isoformat(),
            price_at_analysis=(data.get("quote") or {}).get("latest_price", 0),
            core_conclusion=CoreConclusion(**raw.get("core_conclusion", {})),
            data_perspective=_parse_perspective(raw.get("data_perspective", {})),
            intelligence=_parse_intelligence(raw.get("intelligence", {})),
            battle_plan=BattlePlan(**raw.get("battle_plan", {})),
        )
    except Exception as e:
        logger.warning("LLM JSON parse error: %s — using fallback", e)
        return _fallback_analysis(data)


def _parse_perspective(raw: dict) -> DataPerspective:
    return DataPerspective(
        trend=TrendState(**raw.get("trend", {})),
        price_position=PricePosition(**raw.get("price_position", {})),
        volume=VolumeAnalysis(**raw.get("volume", {})),
    )


def _parse_intelligence(raw: dict) -> MarketIntelligence:
    items = []
    for n in raw.get("recent_news", []):
        items.append(IntelligenceItem(**n))
    return MarketIntelligence(
        news_summary=raw.get("news_summary", ""),
        risk_alerts=raw.get("risk_alerts", []),
        catalysts=raw.get("catalysts", []),
        recent_news=items,
    )


def _fallback_analysis(data: dict) -> DecisionDashboard:
    """Generate basic analysis from indicators when LLM is unavailable."""
    quote = data.get("quote") or {}
    indicators = data.get("indicators", {})
    price = quote.get("latest_price", 0)
    ma5 = indicators.get("ma5", price)
    ma10 = indicators.get("ma10", price)
    ma20 = indicators.get("ma20", price)
    ma60 = indicators.get("ma60", price)

    # Trend detection
    if price > ma5 > ma10 > ma20 > ma60 and all(m > 0 for m in [ma5, ma10, ma20, ma60]):
        trend = TrendState(direction="upward", ma_arrangement="多头排列", strength="强势",
                          description="短期均线上穿中期均线，多头排列完好")
        direction = "bullish"
        confidence = 65
    elif price < ma5 < ma10 < ma20:
        trend = TrendState(direction="downward", ma_arrangement="空头排列", strength="弱势",
                          description="各均线空头排列，短期有进一步下探可能")
        direction = "bearish"
        confidence = 55
    else:
        trend = TrendState(direction="sideways", ma_arrangement="交织", strength="中性",
                          description="均线交织，方向不明，建议观望")
        direction = "neutral"
        confidence = 40

    # Price position
    high_52w = quote.get("high_52w", 0)
    low_52w = quote.get("low_52w", 0)
    if high_52w and low_52w and price > 0:
        pct_from_low = round((price - low_52w) / low_52w * 100, 1)
        pct_from_high = round((high_52w - price) / price * 100, 1) if price > 0 else 0
        support = low_52w
        resistance = high_52w
    else:
        support = round(price * 0.95, 2) if price else 0
        resistance = round(price * 1.05, 2) if price else 0
        pct_from_low = round((price - support) / support * 100, 1) if support else 0
        pct_from_high = round((resistance - price) / price * 100, 1) if price else 0

    pos = PricePosition(
        current=price, support=support, resistance=resistance,
        pct_to_support=pct_from_low, pct_to_resistance=pct_from_high,
        description=f"价格位于支撑{support}和阻力{resistance}之间",
    )

    # Volume
    vol = quote.get("volume", 0)
    vol_desc = "量能正常"
    if vol > 1e8:
        vol_desc = "放量明显，市场关注度高"
    elif vol < 1e6:
        vol_desc = "缩量运行，市场参与度低"
    vol_analysis = VolumeAnalysis(status="正常", volume_ratio=0,
                                  price_volume_relation="--", description=vol_desc)

    return DecisionDashboard(
        code=data["code"],
        name=quote.get("name", "") or "",
        market=data.get("market", ""),
        generated_at=datetime.now(timezone.utc).isoformat(),
        price_at_analysis=price,
        core_conclusion=CoreConclusion(
            direction=direction, confidence=confidence,
            summary=f"基于均线排列的量化分析：{trend.description}",
        ),
        data_perspective=DataPerspective(trend=trend, price_position=pos, volume=vol_analysis),
        intelligence=MarketIntelligence(
            news_summary="（AI 模型不可用，暂无法分析新闻面）",
            risk_alerts=["当前为量化指标自动分析，未结合新闻面"],
            catalysts=[],
        ),
        battle_plan=BattlePlan(
            buy_point=round(price * 0.97, 2) if price else 0,
            sell_point=round(price * 1.08, 2) if price else 0,
            stop_loss=round(price * 0.93, 2) if price else 0,
            position_advice="建议轻仓试探",
            position_pct=20,
            action_items=["观察均线排列是否持续", "等待放量确认方向"],
        ),
    )
