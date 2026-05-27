# CLAUDE.md

## Trade Dashboard — AI 辅助交易决策系统

A股行情看板 + 多AI对话平台。实时行情、K线/分时图、财经资讯聚合、自选股管理、AI 驱动的市场分析。

| 组件 | 目录 | 技术栈 | 端口 |
|------|------|--------|------|
| Backend API | `backend/` | FastAPI + SQLite + Sina/Tencent/EastMoney APIs + DeepSeek/OpenAI-compatible | 8021 |
| Frontend SPA | `frontend/` | React 19 + TypeScript + Vite + Tailwind CSS 3 + lightweight-charts | 5174 |

## 启动命令

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8021
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # Vite dev server, proxies /api → localhost:8021
```

## 架构

### Backend (`backend/app/`)

```
api/routes/
  market.py              # GET /api/market/spot, /quote/{code}, /kline/{code}, /search, /fundflow
  news.py                # GET /api/news/latest, POST /api/news/refresh, GET /api/news/search, /summary
  watchlist.py           # GET/POST/DELETE /api/watchlist
  auth.py                # POST /api/auth/login, /register, /logout, /session
  chat.py                # POST /api/chat (SSE stream), GET /providers, /workspace, /preferences, /memories
  conversations.py       # CRUD /api/conversations
  library.py             # File upload /api/library
  workspace.py           # Workspace management
  security.py            # Security endpoints
  admin.py               # Admin panel endpoints
core/
  config.py              # Pydantic Settings (merged: trade-dashboard + chat), reads .env
  database.py            # SQLite (raw sqlite3, no ORM) — 30+ tables
  security.py            # Argon2 password hashing
  secrets.py             # Fernet encryption for stored API keys
api/deps.py              # Auth dependencies: get_current_user, verify_csrf, require_admin
services/
  market_service.py      # AKShare: 实时行情, K线, 股票搜索, 资金流向
  news_service.py        # 东方财富 + 财联社快讯抓取 + AI 摘要
  watchlist_service.py
  chat_service.py        # AI chat: SSE streaming, market context injection, provider routing
  auth_service.py        # Session/JWT auth, seed admin creation
  conversation_service.py
  provider_registry_service.py  # AI provider registry (DeepSeek, OpenAI, etc.)
  provider_catalog_service.py   # Model resolution and routing
  user_memory_service.py        # User memory extraction from conversations
  library_service.py            # File attachment handling
  workspace_service.py
  usage_analytics_service.py    # Token usage tracking
  user_governance_service.py    # Quotas, permissions
schemas/
  market.py              # Stock quote, K-line, fund flow schemas
  auth.py                # SessionUser, auth request/response
  chat.py                # ChatRequest (includes market_context), ChatMessage, ChatAttachment
  provider_catalog.py
  preferences.py
  workspace.py
main.py                  # FastAPI app + CORS + lifespan (DB init + scheduler)
```

### Frontend (`frontend/src/`)

```
components/
  Layout.tsx              # 顶部导航栏 + 内容区
  StockList.tsx           # 股票列表表格 (行情/自选)
  KLineChart.tsx          # K线图 (lightweight-charts)
  MinuteChart.tsx         # 分时图
  NewsFeed.tsx            # 财经快讯列表
  SectorBoard.tsx         # 板块热度
  ErrorBoundary.tsx
  chat/                   # Chat UI 组件 (来自 Aurora Chat)
    ChatWindow.tsx        # 消息列表 (SSE streaming)
    ChatHeader.tsx        # 模型选择器
    Composer.tsx          # 消息输入框 (文件上传/语音/深度研究)
    MessageBubble.tsx     # 消息气泡 (渲染 Markdown/代码块)
    EmptyState.tsx        # 新对话空状态
    SettingsModal.tsx     # 用户偏好设置
    ChatInfoDrawer.tsx    # 工作区信息面板
    VoiceOverlay.tsx      # 语音输入
    MobilePanels.tsx      # 移动端面板
  sidebar/
    ConversationSidebar.tsx  # 对话列表侧边栏
  auth/                   # 认证组件
  admin/                  # 管理面板组件
  common/                 # 通用组件
features/
  dashboard/
    Dashboard.tsx         # 主看板: 左侧搜索+列表, 右侧 Tab [财经快讯 | AI 对话]
    StockDetail.tsx       # 个股详情: K线图 + 盘口 + 资金流向 + AI 情报 + "与 AI 讨论"按钮
  chat/
    ChatPanel.tsx         # 嵌入式 Chat 面板: 未登录显示登录框, 已登录显示对话界面
  auth/                   # 认证页面
  user-app/               # 用户应用壳
  admin-app/              # 管理应用壳
hooks/
  useMarket.ts            # useSpotList, useKLine, useNews, useWatchlist, etc.
  useAuth.ts              # 认证状态管理 (session cookie 检测)
  useChat.ts              # 对话状态管理 (SSE streaming, 多对话)
  useWorkspace.ts         # 工作区 (provider catalog, library, usage)
  useLayoutMode.ts        # 响应式布局模式
services/
  api.ts                  # fetch 封装 (CSRF cookie 注入, SSE streaming, multi-baseUrl 容错)
  auth.ts                 # 登录/注册/session 管理
  chat.ts                 # streamChat (SSE), workspace, preferences, memories
  conversations.ts        # 对话 CRUD
  aiPlatform.ts           # Provider catalog
  library.ts              # 文件上传
  admin.ts                # 管理 API
  layoutMode.ts
types/
  index.ts                # Trade-dashboard 类型
  chat.ts                 # Chat 类型 (Conversation, ChatMessage, ProviderCatalog, etc.)
  auth.ts                 # Auth 类型 (AuthSession, AuthUser)
  library.ts
  admin.ts
i18n/                     # 国际化 (zh-CN, en-US, ja-JP, es-ES)
lib/                      # 工具函数 (storage, codeHighlight, sanitizeHtml)
utils/chat.ts             # 对话工具 (createId, createConversation, deriveTitle)
```

### 外部数据源
- **AKShare**: 实时行情 (`stock_zh_a_spot_em`) + 历史K线 (`stock_zh_a_hist`)
- **东方财富**: 财经快讯 (`np-listapi.eastmoney.com`)
- **财联社**: 电报快讯 (`cls.cn/api/sw`)
- **Sina Finance**: 分时图数据

### AI Provider
- **DeepSeek**: 通过 OpenAI-compatible API (`/v1/chat/completions`)
- 支持多 provider 注册和自动路由
- 行情上下文通过 `market_context` 字段注入 system message

### 认证
- httpOnly session cookie + CSRF double-submit cookie
- Argon2 密码哈希
- mock CAPTCHA (开发模式, token: `human-pass`)
- 行情数据公开访问, chat 需要登录

### 主题
- 仪表盘: 暗色主题 (#0f0f12)
- Chat 面板: 浅色主题 (CSS 变量 scoped 在 `.chat-panel` 内)
- ChatPanel 使用 React.lazy 懒加载, 不影响首屏性能
