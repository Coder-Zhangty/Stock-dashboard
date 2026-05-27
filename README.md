<div align="center">

# Trade Dashboard · 交易仪表盘

**AI 驱动的量化交易决策系统**  
*AI-Powered Trading Decision System*

</div>

---

## 📖 简介 | Introduction

Trade Dashboard 是一款面向个人交易者的全栈量化决策平台，覆盖 **A 股 / 港股 / 美股** 三大市场。提供实时行情、K 线技术分析、AI 智能决策看板、多策略选股、组合管理、回测系统、告警系统与桌面客户端。

Trade Dashboard is a full-stack quantitative decision platform for retail traders, covering **CN / HK / US** markets with real-time quotes, candlestick charts with technical indicators, AI-powered decision dashboard, multi-strategy screening, portfolio management, backtesting, alerts, and a desktop app.

### 核心功能 | Core Features

| 模块 | 说明 |
|------|------|
| 📊 **实时行情** | A股/港股/美股实时报价、K线图、分时图、多周期技术指标 (MA/BOLL/MACD/KDJ/RSI) |
| 🤖 **AI 决策看板** | LLM 驱动的结构化分析：趋势判断 + 价格位置 + 成交量 + 交易计划 |
| 🎯 **策略选股** | 16 个 YAML 可配置策略 (均线金叉/放量突破/回踩低吸/海龟交易…) + 评分引擎 |
| 💼 **组合管理** | 持仓/资金流水/公司事件(分红/拆股)/CSV导入/风险报告 (VaR/夏普/回撤) |
| ⏪ **回测系统** | AI 预测准确度追踪、方向胜率统计、置信度校准 |
| 🔔 **智能告警** | 价格/指标/成交量/盈亏 7 种条件触发、冷却时间、多渠道通知 |
| 🔗 **多数据源容灾** | 东方财富/腾讯/新浪/Yahoo Finance，断路器自动故障转移 |
| 📢 **消息推送** | 11 个通道：企业微信/飞书/Telegram/邮件/Discord/Slack/Pushover/ntfy/Gotify/PushPlus/Server酱 |
| 🖥️ **桌面客户端** | Electron 壳、系统托盘、后端进程管理、自动更新 |

---

## 🛠 技术栈 | Tech Stack

| 层 | 技术 |
|----|------|
| **Backend** | Python 3.11+ · FastAPI · SQLite · httpx · AKShare |
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS 3 · lightweight-charts |
| **AI** | DeepSeek / OpenAI-compatible · SSE Streaming |
| **Desktop** | Electron · electron-builder · system tray |
| **数据源** | 东方财富 · 腾讯证券 · 新浪财经 · Yahoo Finance |

---

## 🚀 快速开始 | Quick Start

### 环境要求 | Prerequisites

- Python ≥ 3.11
- Node.js ≥ 18
- npm ≥ 9

### 1. 克隆仓库 | Clone

```bash
git clone https://github.com/你的用户名/trade-dashboard.git
cd trade-dashboard
```

### 2. 后端 | Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8021
```

后端运行在 `http://localhost:8021`，API 文档在 `http://localhost:8021/docs`

### 3. 前端 | Frontend

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5174`，自动代理 `/api` 到后端。

### 4. 环境变量 | Environment

复制 `backend/.env.example` 为 `backend/.env`，按需填入配置：

```bash
# AI Provider (选填，不填也能用行情功能)
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-your-key-here

# 推送通知 (选填)
WECOM_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
# ... 其他通道见 config.py
```

---

## 📁 项目结构 | Project Structure

```
trade-dashboard/
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── api/routes/       # API 路由 (行情/新闻/组合/告警/回测/AI)
│   │   ├── core/             # 配置/数据库/安全
│   │   ├── services/         # 业务逻辑层
│   │   │   ├── data_provider/  # 多数据源容灾框架
│   │   │   ├── push_channels/  # 11 个推送通道
│   │   │   └── ...           # 策略引擎/回测/告警等服务
│   │   └── schemas/          # Pydantic 数据模型
│   └── strategies/           # 16 个 YAML 选股策略
├── frontend/                 # React 前端
│   └── src/
│       ├── features/dashboard/  # 仪表盘/个股详情/AI面板/组合/告警
│       ├── features/chat/       # AI 对话
│       ├── hooks/               # 自定义 Hooks
│       └── services/            # API 封装
└── desktop/                  # Electron 桌面应用
    ├── main.js               # 主进程 (系统托盘/后端管理)
    ├── preload.js            # 安全桥接
    └── package.json          # electron-builder 打包配置
```

---

## 🔒 安全提醒 | Security Notice

- **永远不要** 将 `.env` 或包含密钥的文件提交到 Git
- 仓库已配置 `.gitignore`，自动忽略 `.env`、`*.db`、`node_modules/` 等
- 首次部署前务必修改 `backend/.env` 中的默认管理员密码

---

## 📄 许可 | License

MIT License — 详见 [LICENSE](LICENSE)

---

<div align="center">
  <sub>Built with ❤️ for traders · 为交易而生</sub>
</div>
