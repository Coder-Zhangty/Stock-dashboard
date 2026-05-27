from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from app.services import market_service

logger = logging.getLogger(__name__)

BEIJING_TZ = timezone(timedelta(hours=8))


async def generate_html_report(report_type: str = "daily") -> str:
    """Generate an HTML market report suitable for PDF conversion or email."""
    now = datetime.now(BEIJING_TZ)
    date_str = now.strftime("%Y-%m-%d")

    # Gather data
    indices = await market_service.get_indices()
    breadth = await market_service.get_market_breadth()
    sectors = await market_service.fetch_sectors("industry")

    # Build HTML
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; color: #1a1a2e; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8f9fa; }}
  h1 {{ color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; font-size: 24px; }}
  h2 {{ color: #334155; font-size: 18px; margin-top: 24px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }}
  th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
  th {{ background: #f1f5f9; color: #475569; font-weight: 600; }}
  .up {{ color: #dc2626; }}
  .down {{ color: #16a34a; }}
  .muted {{ color: #94a3b8; font-size: 12px; }}
  .card {{ background: white; border-radius: 8px; padding: 16px; margin: 12px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
  .summary {{ display: flex; gap: 16px; flex-wrap: wrap; }}
  .stat {{ background: white; border-radius: 8px; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
  .stat-label {{ font-size: 11px; color: #64748b; }}
  .stat-value {{ font-size: 20px; font-weight: 700; }}
</style>
</head>
<body>
<h1>{'市场日报' if report_type == 'daily' else '市场周报' if report_type == 'weekly' else '盘前简报'}</h1>
<p class="muted">生成时间: {now.strftime('%Y-%m-%d %H:%M')} (北京时间)</p>
"""

    # Indices
    if indices:
        html += "<h2>主要指数</h2><table><tr><th>指数</th><th>最新价</th><th>涨跌幅</th></tr>"
        for idx in indices:
            cls = "up" if idx["change_pct"] >= 0 else "down"
            html += f"<tr><td>{idx['name']}</td><td>{idx['latest_price']:.2f}</td><td class='{cls}'>{idx['change_pct']:+.2f}%</td></tr>"
        html += "</table>"

    # Market breadth
    if breadth["total"] > 0:
        html += "<div class='card'><h2>市场情绪</h2><div class='summary'>"
        html += f"<div class='stat'><div class='stat-label'>上涨</div><div class='stat-value up'>{breadth['up']}</div></div>"
        html += f"<div class='stat'><div class='stat-label'>下跌</div><div class='stat-value down'>{breadth['down']}</div></div>"
        html += f"<div class='stat'><div class='stat-label'>平盘</div><div class='stat-value muted'>{breadth['flat']}</div></div>"
        html += f"<div class='stat'><div class='stat-label'>总计</div><div class='stat-value'>{breadth['total']}</div></div>"
        html += "</div></div>"

    # Top sectors
    sorted_sectors = sorted(sectors, key=lambda s: s["change_pct"], reverse=True)
    if sorted_sectors:
        html += "<h2>板块热度 TOP 10</h2><table><tr><th>板块</th><th>涨跌幅</th><th>领涨股</th></tr>"
        for s in sorted_sectors[:10]:
            cls = "up" if s["change_pct"] >= 0 else "down"
            html += f"<tr><td>{s['name']}</td><td class='{cls}'>{s['change_pct']:+.2f}%</td><td>{s.get('lead_name', s.get('lead_stock', ''))}</td></tr>"
        html += "</table>"

    html += f"""
<p class="muted" style="margin-top:32px">
  本报告由 Trade Dashboard 自动生成。数据来源：新浪财经、东方财富、腾讯财经。<br>
  免责声明：本报告仅供参考，不构成投资建议。
</p>
</body></html>"""

    return html
