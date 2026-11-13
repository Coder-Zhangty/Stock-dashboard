# Trade Dashboard · 交易仪表盘

[简体中文](#简体中文) · [English](#english)

## 简体中文

Trade Dashboard 是一个覆盖 A 股、港股和美股的个人投研工作台。它把行情、技术指标、策略筛选和组合分析放在同一界面，并可接入大模型生成结构化的个股分析。

| 功能 | 说明 |
|---|---|
| 行情与图表 | 查看报价、K 线及 MA、BOLL、MACD、KDJ、RSI 等指标 |
| 策略研究 | 使用 YAML 策略筛选标的，追踪分析结果和预测表现 |
| 投资组合 | 管理持仓、资金流水和公司事件，查看收益与风险指标 |
| 告警 | 配置价格、指标、成交量或盈亏条件，按需接入通知服务 |

### 本地运行

需要 Python 3.11+ 和 Node.js 22.12+。

```bash
git clone https://github.com/Coder-Zhangty/Stock-dashboard.git
cd Stock-dashboard
cp .env.example backend/.env
cd backend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS / Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8021
```

从项目根目录另开一个终端。

```bash
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5174`。后端 API 文档位于 `http://localhost:8021/docs`。AI 相关配置使用 `AI_PROVIDER`、`AI_MODEL`、`AI_BASE_URL` 和 `AI_API_KEY`，见 [环境模板](.env.example)。

## English

Trade Dashboard is a personal research workspace for mainland Chinese, Hong Kong and US stocks. It brings together quotes, technical indicators, screening and portfolio analytics. An optional language model integration produces structured stock research.

| Feature | What you can do |
|---|---|
| Quotes and charts | View quotes, candlesticks and MA, BOLL, MACD, KDJ and RSI indicators |
| Strategy research | Screen symbols with YAML strategies and track forecast performance |
| Portfolio | Record positions, cash flows and corporate actions and review risk metrics |
| Alerts | Monitor price, technical indicators, volume or profit and loss through configured notification channels |

### Run locally

Use Python 3.11+ and Node.js 22.12+. Follow the backend and frontend commands above in separate terminals. Open `http://localhost:5174`; interactive API documentation is at `http://localhost:8021/docs`. The [environment template](.env.example) shows provider and account settings.

## 项目目录 / Project layout

- [backend](backend) — FastAPI、SQLite、行情和策略服务 / FastAPI, SQLite, market data and strategy services
- [frontend](frontend) — React、TypeScript 和交互式图表 / React, TypeScript and interactive charts
- [desktop](desktop) — Electron 桌面入口 / Electron desktop entry point
