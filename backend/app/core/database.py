from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.core.config import settings

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _db_path() -> str:
    raw = settings.database_url
    if raw and Path(raw).is_absolute():
        return raw
    if raw:
        return str(PROJECT_ROOT / raw)
    return str(PROJECT_ROOT / "storage" / "app.db")


def _upload_dir() -> str:
    raw = settings.upload_dir
    if raw and Path(raw).is_absolute():
        return raw
    if raw:
        return str(PROJECT_ROOT / raw)
    return str(PROJECT_ROOT / "storage" / "uploads")


def ensure_storage() -> tuple[Path, Path]:
    db_path = Path(_db_path())
    upload_path = Path(_upload_dir())
    db_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.mkdir(parents=True, exist_ok=True)
    return db_path, upload_path


def get_connection() -> sqlite3.Connection:
    db_path = _db_path()
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def _ensure_dirs() -> None:
    Path(_upload_dir()).mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    conn = get_connection()
    try:
        # ── Market / Trade Dashboard tables ──
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                market TEXT NOT NULL DEFAULT 'SH',
                added_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                notes TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS daily_kline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL,
                amount REAL NOT NULL,
                period TEXT NOT NULL DEFAULT 'daily',
                UNIQUE(code, trade_date, period)
            );

            CREATE TABLE IF NOT EXISTS stock_list (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                market TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS stock_list_hk (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                market TEXT NOT NULL DEFAULT 'HK',
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS stock_list_us (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                market TEXT NOT NULL DEFAULT 'US',
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS news_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT,
                content TEXT,
                related_code TEXT,
                sentiment TEXT DEFAULT '',
                published_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                UNIQUE(source, title)
            );

            CREATE INDEX IF NOT EXISTS idx_daily_kline_code ON daily_kline(code);
            CREATE INDEX IF NOT EXISTS idx_daily_kline_date ON daily_kline(trade_date);
            CREATE INDEX IF NOT EXISTS idx_news_cache_date ON news_cache(published_at);
            CREATE INDEX IF NOT EXISTS idx_news_cache_code ON news_cache(related_code);
            CREATE INDEX IF NOT EXISTS idx_watchlist_code ON watchlist(code);

            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
            CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(created_at);

            -- Portfolio tables
            CREATE TABLE IF NOT EXISTS portfolios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL DEFAULT 'My Portfolio',
                initial_capital REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS portfolio_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                market TEXT NOT NULL DEFAULT 'CN',
                quantity INTEGER NOT NULL DEFAULT 0,
                avg_cost REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
                UNIQUE(portfolio_id, code)
            );

            CREATE TABLE IF NOT EXISTS portfolio_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                tx_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                amount REAL NOT NULL,
                fee REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
            CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON portfolio_positions(portfolio_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_portfolio ON portfolio_transactions(portfolio_id);

            -- Cash ledger for portfolio
            CREATE TABLE IF NOT EXISTS cash_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'trade', 'dividend', 'fee')),
                amount REAL NOT NULL,
                balance_after REAL NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_cash_ledger_portfolio ON cash_ledger(portfolio_id);

            -- Corporate actions (dividends, splits)
            CREATE TABLE IF NOT EXISTS corporate_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                action_type TEXT NOT NULL CHECK(action_type IN ('dividend', 'split', 'rights_issue', 'spinoff')),
                ratio REAL,
                amount REAL,
                ex_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_corp_actions_portfolio ON corporate_actions(portfolio_id);

            -- Portfolio NAV history snapshots (daily)
            CREATE TABLE IF NOT EXISTS portfolio_nav_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                nav_date TEXT NOT NULL,
                total_value REAL NOT NULL,
                cash_balance REAL NOT NULL,
                position_value REAL NOT NULL,
                pnl REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
                UNIQUE(portfolio_id, nav_date)
            );
            CREATE INDEX IF NOT EXISTS idx_nav_history_portfolio ON portfolio_nav_history(portfolio_id);
            CREATE INDEX IF NOT EXISTS idx_nav_history_date ON portfolio_nav_history(nav_date);

            -- Backtest records for AI analysis accuracy tracking
            CREATE TABLE IF NOT EXISTS backtest_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                code TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                market TEXT NOT NULL DEFAULT 'CN',
                direction TEXT NOT NULL CHECK(direction IN ('bullish', 'bearish', 'neutral')),
                confidence INTEGER NOT NULL CHECK(confidence BETWEEN 1 AND 100),
                price_at_analysis REAL NOT NULL,
                target_price REAL,
                stop_loss REAL,
                analysis_json TEXT,
                outcome_checked INTEGER NOT NULL DEFAULT 0,
                outcome_direction TEXT,
                outcome_price REAL,
                outcome_pnl_pct REAL,
                outcome_checked_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_backtest_user ON backtest_records(user_id);
            CREATE INDEX IF NOT EXISTS idx_backtest_code ON backtest_records(code);
            CREATE INDEX IF NOT EXISTS idx_backtest_outcome ON backtest_records(outcome_checked);

            -- Alert rules
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                alert_type TEXT NOT NULL CHECK(alert_type IN ('price', 'indicator', 'news', 'pnl', 'volume')),
                code TEXT NOT NULL DEFAULT '',
                market TEXT NOT NULL DEFAULT 'CN',
                condition_field TEXT NOT NULL DEFAULT 'latest_price',
                condition_op TEXT NOT NULL CHECK(condition_op IN ('gt', 'lt', 'gte', 'lte', 'cross_above', 'cross_below', 'pct_change')),
                condition_value REAL NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                last_triggered_at TEXT,
                cooldown_minutes INTEGER NOT NULL DEFAULT 60,
                notify_channels TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
            CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

            -- Alert trigger history
            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                triggered_value REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history(user_id);

            CREATE VIRTUAL TABLE IF NOT EXISTS news_fts USING fts5(
                title, content, content='news_cache', content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS news_cache_ai AFTER INSERT ON news_cache BEGIN
                INSERT INTO news_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS news_cache_ad AFTER DELETE ON news_cache BEGIN
                INSERT INTO news_fts(news_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
            END;

            CREATE TRIGGER IF NOT EXISTS news_cache_au AFTER UPDATE ON news_cache BEGIN
                INSERT INTO news_fts(news_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
                INSERT INTO news_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
            END;
        """)

        # Populate FTS index with existing news_cache data (idempotent)
        try:
            conn.execute("INSERT INTO news_fts(rowid, title, content) SELECT id, title, content FROM news_cache WHERE id NOT IN (SELECT rowid FROM news_fts)")
        except Exception:
            pass

        # ── Chat / Aurora tables ──
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                refresh_token_hash TEXT NOT NULL,
                user_agent TEXT,
                ip_address TEXT,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS auth_rate_limits (
                id TEXT PRIMARY KEY,
                scope_type TEXT NOT NULL,
                scope_key TEXT NOT NULL,
                action_type TEXT NOT NULL,
                failure_count INTEGER NOT NULL DEFAULT 0,
                last_failure_at TEXT,
                cooldown_until TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(scope_type, scope_key, action_type)
            );

            CREATE TABLE IF NOT EXISTS providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key_encrypted TEXT,
                api_key_masked TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                visible_to_users INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'unknown',
                description TEXT,
                last_checked_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                internal_name TEXT NOT NULL,
                type TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                visible_to_users INTEGER NOT NULL DEFAULT 1,
                allow_auto_select INTEGER NOT NULL DEFAULT 1,
                is_default_for_user INTEGER NOT NULL DEFAULT 0,
                is_default_for_admin INTEGER NOT NULL DEFAULT 0,
                input_price_per_1k REAL,
                output_price_per_1k REAL,
                image_price_per_call REAL,
                priority INTEGER NOT NULL DEFAULT 0,
                context_window INTEGER,
                tags TEXT,
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                FOREIGN KEY(provider_id) REFERENCES providers(id)
            );

            CREATE TABLE IF NOT EXISTS model_fallbacks (
                id TEXT PRIMARY KEY,
                source_model_id TEXT NOT NULL,
                fallback_model_id TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS routing_policies (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                default_user_model_id TEXT,
                default_admin_model_id TEXT,
                allow_user_model_switching INTEGER NOT NULL DEFAULT 1,
                allow_auto_model_selection INTEGER NOT NULL DEFAULT 1,
                auto_model_strategy_default TEXT NOT NULL DEFAULT 'high_quality',
                fallback_enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_model_access (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, model_id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_quota_overrides (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                daily_token_limit INTEGER,
                monthly_token_limit INTEGER,
                max_selectable_models INTEGER,
                allow_auto_model_selection INTEGER,
                can_use_vision_models INTEGER,
                can_use_high_cost_models INTEGER,
                allow_model_switching INTEGER,
                overage_strategy TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_control_settings (
                user_id TEXT PRIMARY KEY,
                token_quota_daily INTEGER NOT NULL DEFAULT 160000,
                token_quota_monthly INTEGER NOT NULL DEFAULT 3600000,
                total_credit_limit REAL NOT NULL DEFAULT 0,
                request_limit_daily INTEGER NOT NULL DEFAULT 180,
                max_request_tokens INTEGER NOT NULL DEFAULT 12000,
                max_selectable_models INTEGER NOT NULL DEFAULT 4,
                auto_model_selection_enabled INTEGER NOT NULL DEFAULT 1,
                can_use_vision_models INTEGER NOT NULL DEFAULT 1,
                can_use_high_cost_models INTEGER NOT NULL DEFAULT 0,
                allow_overage INTEGER NOT NULL DEFAULT 0,
                overage_behavior TEXT NOT NULL DEFAULT 'notify',
                default_model_id TEXT,
                allowed_model_ids TEXT NOT NULL DEFAULT '[]',
                allowed_provider_ids TEXT NOT NULL DEFAULT '[]',
                feature_overrides TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY,
                memory_enabled INTEGER NOT NULL DEFAULT 1,
                tone_style TEXT NOT NULL DEFAULT 'professional',
                warmth INTEGER NOT NULL DEFAULT 55,
                response_length INTEGER NOT NULL DEFAULT 62,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_memories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                source_conversation_id TEXT,
                confidence REAL NOT NULL DEFAULT 0.7,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                selected_model_id TEXT,
                auto_model_strategy TEXT,
                last_message_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived_at TEXT,
                deleted_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                user_id TEXT,
                role TEXT NOT NULL,
                content_text TEXT NOT NULL,
                model_id TEXT,
                provider_id TEXT,
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                total_tokens INTEGER,
                estimated_cost REAL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS library_items (
                id TEXT PRIMARY KEY,
                owner_id TEXT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                kind TEXT NOT NULL,
                source TEXT NOT NULL,
                size_label TEXT NOT NULL,
                file_path TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS library_files (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                uploader_name TEXT,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                mime_type TEXT,
                file_size_bytes INTEGER NOT NULL DEFAULT 0,
                storage_path TEXT NOT NULL,
                source_type TEXT NOT NULL,
                index_status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS file_references (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                message_id TEXT,
                referenced_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_usage_events (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                conversation_id TEXT,
                user_name TEXT,
                user_email TEXT,
                role TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                mode TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                estimated_cost REAL NOT NULL DEFAULT 0,
                request_status TEXT NOT NULL DEFAULT 'success',
                selected_strategy TEXT,
                attachment_count INTEGER NOT NULL DEFAULT 0,
                last_user_message_preview TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS usage_records (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                conversation_id TEXT,
                message_id TEXT,
                provider_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                request_type TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                estimated_cost REAL NOT NULL DEFAULT 0,
                request_status TEXT NOT NULL,
                latency_ms INTEGER,
                error_code TEXT,
                error_message TEXT,
                selected_strategy TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                actor_id TEXT,
                actor_name TEXT NOT NULL,
                actor_role TEXT NOT NULL,
                action_type TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT,
                target_label TEXT NOT NULL,
                detail TEXT NOT NULL,
                result TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS security_events (
                id TEXT PRIMARY KEY,
                actor_user_id TEXT,
                email TEXT,
                action_type TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                result TEXT NOT NULL,
                detail_json TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS billing_cycles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                cycle_start TEXT NOT NULL,
                cycle_end TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                estimated_cost REAL NOT NULL DEFAULT 0,
                paid_amount REAL,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS billing_summaries (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                cycle TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                estimated_cost REAL NOT NULL DEFAULT 0,
                paid_amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'open',
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS managed_provider_settings (
                provider_id TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                visible_to_users INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS managed_model_settings (
                provider_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                role_scope TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY(provider_id, model_id, role_scope)
            );

            CREATE TABLE IF NOT EXISTS managed_routing_settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                user_default_provider TEXT NOT NULL,
                user_default_model TEXT NOT NULL,
                admin_default_provider TEXT NOT NULL,
                admin_default_model TEXT NOT NULL,
                allow_user_model_switch INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS permission_settings (
                key TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS provider_runtime_configs (
                provider_id TEXT PRIMARY KEY,
                base_url TEXT NOT NULL DEFAULT '',
                configured_model TEXT NOT NULL DEFAULT '',
                api_key_encrypted TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS platform_quota_rules (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                default_daily_token_limit INTEGER NOT NULL DEFAULT 160000,
                default_monthly_token_limit INTEGER NOT NULL DEFAULT 3600000,
                default_max_selectable_models INTEGER NOT NULL DEFAULT 4,
                default_allow_auto_model_selection INTEGER NOT NULL DEFAULT 1,
                default_allow_model_switching INTEGER NOT NULL DEFAULT 1,
                default_can_use_vision_models INTEGER NOT NULL DEFAULT 1,
                default_can_use_high_cost_models INTEGER NOT NULL DEFAULT 0,
                default_overage_strategy TEXT NOT NULL DEFAULT 'warn',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS policies (
                id TEXT PRIMARY KEY,
                subject_type TEXT NOT NULL,
                subject_id TEXT,
                web_search INTEGER NOT NULL DEFAULT 1,
                deep_research INTEGER NOT NULL DEFAULT 1,
                image_tools INTEGER NOT NULL DEFAULT 1,
                voice_mode INTEGER NOT NULL DEFAULT 1,
                agent_mode INTEGER NOT NULL DEFAULT 1,
                library_upload INTEGER NOT NULL DEFAULT 1,
                model_switching INTEGER NOT NULL DEFAULT 1,
                auto_model_select INTEGER NOT NULL DEFAULT 1,
                vision_access INTEGER NOT NULL DEFAULT 1,
                high_cost_model_access INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS provider_health_checks (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                status TEXT NOT NULL,
                latency_ms INTEGER,
                checked_at TEXT NOT NULL,
                detail_json TEXT
            );

            CREATE TABLE IF NOT EXISTS system_events (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                detail_json TEXT,
                created_at TEXT NOT NULL,
                resolved_at TEXT
            );
        """)

        # ── Chat schema migrations ──
        _ensure_column(conn, "users", "password_reset_required", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "users", "last_login_at", "TEXT")
        _ensure_column(conn, "users", "last_active_at", "TEXT")
        _ensure_column(conn, "users", "avatar_url", "TEXT")
        _ensure_column(conn, "users", "updated_at", "TEXT")
        _ensure_column(conn, "users", "deleted_at", "TEXT")
        _ensure_column(conn, "users", "email_verified_at", "TEXT")
        _ensure_column(conn, "users", "mfa_enabled", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "users", "mfa_type", "TEXT")
        _ensure_column(conn, "users", "mfa_secret_encrypted", "TEXT")
        _ensure_column(conn, "users", "failed_login_count", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "users", "locked_until", "TEXT")
        _ensure_column(conn, "providers", "visible_to_users", "INTEGER NOT NULL DEFAULT 1")
        _ensure_column(conn, "providers", "last_synced_at", "TEXT")
        _ensure_column(conn, "providers", "sync_status", "TEXT")
        _ensure_column(conn, "providers", "sync_error", "TEXT")
        _ensure_column(conn, "providers", "external_quota_json", "TEXT")
        _ensure_column(conn, "chat_usage_events", "conversation_id", "TEXT")
        _ensure_column(conn, "chat_usage_events", "estimated_cost", "REAL NOT NULL DEFAULT 0")
        _ensure_column(conn, "chat_usage_events", "request_status", "TEXT NOT NULL DEFAULT 'success'")
        _ensure_column(conn, "chat_usage_events", "selected_strategy", "TEXT")
        _ensure_column(conn, "user_sessions", "session_token_hash", "TEXT")
        _ensure_column(conn, "user_sessions", "last_seen_at", "TEXT")
        _ensure_column(conn, "audit_logs", "email", "TEXT")
        _ensure_column(conn, "audit_logs", "ip_address", "TEXT")
        _ensure_column(conn, "audit_logs", "user_agent", "TEXT")
        _ensure_column(conn, "audit_logs", "detail_json", "TEXT")

        # ── Market schema migrations ──
        for table in ("stock_list", "stock_list_hk", "stock_list_us"):
            try:
                cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
                for col, col_type in [("latest_price", "REAL"), ("change_pct", "REAL"), ("change_amount", "REAL"), ("volume", "REAL"), ("amount", "REAL"), ("turnover", "REAL"), ("open", "REAL"), ("high", "REAL"), ("low", "REAL"), ("prev_close", "REAL"), ("snapshot_at", "TEXT")]:
                    if col not in cols:
                        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                conn.commit()
            except Exception:
                pass

        try:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(daily_kline)").fetchall()]
            if "period" not in cols:
                conn.execute("ALTER TABLE daily_kline ADD COLUMN period TEXT NOT NULL DEFAULT 'daily'")
                conn.commit()
        except Exception:
            pass

        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS daily_kline_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL,
                    trade_date TEXT NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume REAL NOT NULL,
                    amount REAL NOT NULL,
                    period TEXT NOT NULL DEFAULT 'daily',
                    UNIQUE(code, trade_date, period)
                );
                INSERT OR IGNORE INTO daily_kline_new
                    SELECT id, code, trade_date, open, high, low, close, volume, amount, 'daily'
                    FROM daily_kline;
                DROP TABLE daily_kline;
                ALTER TABLE daily_kline_new RENAME TO daily_kline;
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_daily_kline_code ON daily_kline(code)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_daily_kline_date ON daily_kline(trade_date)")

            # Migration: add turnover_rate column
            try:
                conn.execute("ALTER TABLE daily_kline ADD COLUMN turnover_rate REAL")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE daily_kline ADD COLUMN amplitude REAL")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE daily_kline ADD COLUMN change_pct REAL")
            except Exception:
                pass
        except Exception:
            pass

        conn.commit()
    finally:
        conn.close()


_VALID_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_COL_DEF_RE = re.compile(
    r"^(TEXT|INTEGER)(\s+NOT\s+NULL)?(\s+DEFAULT\s+['\"]?\w*['\"]?)?$",
    re.IGNORECASE,
)


def _assert_safe_identifier(name: str) -> None:
    if not _VALID_IDENTIFIER_RE.match(name):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")


def _column_exists(connection: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    _assert_safe_identifier(table_name)
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row["name"] == column_name for row in rows)


def _ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    _assert_safe_identifier(table_name)
    _assert_safe_identifier(column_name)
    if _column_exists(connection, table_name, column_name):
        return
    if not _COL_DEF_RE.match(column_definition.strip()):
        raise ValueError(f"Unexpected column definition: {column_definition!r}")
    connection.execute(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
    )
