from __future__ import annotations

import logging
from typing import Any

from app.core.database import get_connection
from app.services import market_service

logger = logging.getLogger(__name__)

VALID_TX_TYPES = {"buy", "sell"}


def _owns_portfolio(portfolio_id: int, user_id: int) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM portfolios WHERE id=? AND user_id=?",
        (portfolio_id, user_id),
    ).fetchone()
    conn.close()
    return row is not None


def _validate_transaction(tx_type: str, quantity: int, price: float) -> str | None:
    if tx_type not in VALID_TX_TYPES:
        return f"Invalid transaction type: {tx_type}"
    if quantity <= 0:
        return "Quantity must be positive"
    if price < 0:
        return "Price cannot be negative"
    return None


def create_portfolio(user_id: int, name: str = "My Portfolio", initial_capital: float = 0) -> dict[str, Any]:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO portfolios (user_id, name, initial_capital) VALUES (?, ?, ?)",
        (user_id, name, initial_capital),
    )
    conn.commit()
    pid = cur.lastrowid
    row = conn.execute("SELECT * FROM portfolios WHERE id=?", (pid,)).fetchone()
    conn.close()
    return dict(row) if row else {}


def get_portfolios(user_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM portfolios WHERE user_id=? ORDER BY updated_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_portfolio(portfolio_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM portfolios WHERE id=?", (portfolio_id,)).fetchone()
    positions = conn.execute(
        "SELECT * FROM portfolio_positions WHERE portfolio_id=?",
        (portfolio_id,),
    ).fetchall()
    conn.close()
    if not row:
        return None
    result = dict(row)
    result["positions"] = [dict(p) for p in positions]
    return result


def delete_portfolio(portfolio_id: int, user_id: int | None = None) -> bool:
    if user_id is not None and not _owns_portfolio(portfolio_id, user_id):
        return False
    conn = get_connection()
    conn.execute("DELETE FROM portfolios WHERE id=?", (portfolio_id,))
    conn.commit()
    deleted = conn.total_changes > 0
    conn.close()
    return deleted


def add_transaction(
    portfolio_id: int, code: str, name: str, tx_type: str,
    quantity: int, price: float, fee: float = 0,
) -> dict[str, Any]:
    amount = quantity * price
    conn = get_connection()

    conn.execute(
        """INSERT INTO portfolio_transactions (portfolio_id, code, name, tx_type, quantity, price, amount, fee)
           VALUES (?,?,?,?,?,?,?,?)""",
        (portfolio_id, code, name, tx_type, quantity, price, amount, fee),
    )

    # Upsert position
    existing = conn.execute(
        "SELECT * FROM portfolio_positions WHERE portfolio_id=? AND code=?",
        (portfolio_id, code),
    ).fetchone()

    if tx_type == "buy":
        if existing:
            total_qty = existing["quantity"] + quantity
            total_cost = existing["avg_cost"] * existing["quantity"] + amount + fee
            new_avg = total_cost / total_qty if total_qty > 0 else 0
            conn.execute(
                "UPDATE portfolio_positions SET quantity=?, avg_cost=?, name=?, updated_at=datetime('now','localtime') WHERE id=?",
                (total_qty, round(new_avg, 4), name, existing["id"]),
            )
        else:
            avg = (amount + fee) / quantity if quantity > 0 else price
            conn.execute(
                "INSERT INTO portfolio_positions (portfolio_id, code, name, quantity, avg_cost) VALUES (?,?,?,?,?)",
                (portfolio_id, code, name, quantity, round(avg, 4)),
            )
    elif tx_type == "sell":
        if existing and existing["quantity"] >= quantity:
            new_qty = existing["quantity"] - quantity
            if new_qty > 0:
                conn.execute(
                    "UPDATE portfolio_positions SET quantity=?, updated_at=datetime('now','localtime') WHERE id=?",
                    (new_qty, existing["id"]),
                )
            else:
                conn.execute("DELETE FROM portfolio_positions WHERE id=?", (existing["id"],))

    # Record cash ledger entry for trade
    cash_impact = -amount - fee if tx_type == "buy" else amount - fee
    current_bal = _get_cash_balance(conn, portfolio_id)
    new_bal = current_bal + cash_impact
    conn.execute(
        "INSERT INTO cash_ledger (portfolio_id, type, amount, balance_after, description) VALUES (?,?,?,?,?)",
        (portfolio_id, "trade", cash_impact, new_bal, f"{tx_type} {quantity} {code} @ {price}"),
    )

    conn.execute(
        "UPDATE portfolios SET updated_at=datetime('now','localtime') WHERE id=?",
        (portfolio_id,),
    )
    conn.commit()
    conn.close()

    return {"status": "ok", "amount": round(amount, 2)}


async def get_portfolio_summary(portfolio_id: int, user_id: int | None = None) -> dict[str, Any]:
    """Get portfolio summary with real-time P&L."""
    if user_id is not None and not _owns_portfolio(portfolio_id, user_id):
        return {"error": "Portfolio not found"}
    portfolio = get_portfolio(portfolio_id)
    if not portfolio:
        return {"error": "Portfolio not found"}

    positions = portfolio.get("positions", [])
    if not positions:
        return {
            **portfolio,
            "total_market_value": 0,
            "total_cost": 0,
            "total_pnl": 0,
            "total_pnl_pct": 0,
            "positions": [],
        }

    codes = [p["code"] for p in positions]
    try:
        quotes = await market_service.batch_quotes(codes)
    except Exception:
        quotes = {}

    total_cost = 0.0
    total_value = 0.0
    enriched: list[dict[str, Any]] = []

    for pos in positions:
        code = pos["code"]
        qty = pos["quantity"]
        cost = pos["avg_cost"] * qty
        total_cost += cost

        quote = quotes.get(code, {})
        current_price = quote.get("latest_price", 0)
        market_value = current_price * qty
        total_value += market_value
        pnl = market_value - cost
        pnl_pct = (pnl / cost * 100) if cost > 0 else 0

        enriched.append({
            **pos,
            "current_price": round(current_price, 2),
            "market_value": round(market_value, 2),
            "cost_basis": round(cost, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
        })

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    return {
        "id": portfolio["id"],
        "name": portfolio["name"],
        "initial_capital": portfolio["initial_capital"],
        "total_market_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "positions": enriched,
    }


def get_transactions(portfolio_id: int, limit: int = 50) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM portfolio_transactions WHERE portfolio_id=? ORDER BY created_at DESC LIMIT ?",
        (portfolio_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Cash Ledger ────────────────────────────────────────────────────────────

def _get_cash_balance(conn, portfolio_id: int) -> float:
    row = conn.execute(
        "SELECT balance_after FROM cash_ledger WHERE portfolio_id=? ORDER BY id DESC LIMIT 1",
        (portfolio_id,),
    ).fetchone()
    if row:
        return row["balance_after"]
    # Fall back to initial_capital
    p = conn.execute("SELECT initial_capital FROM portfolios WHERE id=?", (portfolio_id,)).fetchone()
    return p["initial_capital"] if p else 0.0


def record_cash_entry(portfolio_id: int, entry_type: str, amount: float, description: str = "") -> dict[str, Any]:
    """Record a cash ledger entry (deposit, withdraw, trade, dividend, fee)."""
    conn = get_connection()
    current = _get_cash_balance(conn, portfolio_id)
    new_balance = current + amount
    conn.execute(
        "INSERT INTO cash_ledger (portfolio_id, type, amount, balance_after, description) VALUES (?,?,?,?,?)",
        (portfolio_id, entry_type, amount, new_balance, description),
    )
    conn.execute(
        "UPDATE portfolios SET updated_at=datetime('now','localtime') WHERE id=?",
        (portfolio_id,),
    )
    conn.commit()
    conn.close()
    return {"entry_type": entry_type, "amount": amount, "balance": round(new_balance, 2)}


def get_cash_ledger(portfolio_id: int, limit: int = 100) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM cash_ledger WHERE portfolio_id=? ORDER BY created_at DESC LIMIT ?",
        (portfolio_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_cash_summary(portfolio_id: int) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute(
        """SELECT
             COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END), 0) as total_deposits,
             COALESCE(SUM(CASE WHEN type='withdraw' THEN -amount ELSE 0 END), 0) as total_withdrawals,
             COALESCE(SUM(CASE WHEN type='dividend' THEN amount ELSE 0 END), 0) as total_dividends,
             COALESCE(SUM(CASE WHEN type='fee' THEN -amount ELSE 0 END), 0) as total_fees,
             COALESCE(SUM(CASE WHEN type='trade' THEN amount ELSE 0 END), 0) as net_trade_cash
         FROM cash_ledger WHERE portfolio_id=?""",
        (portfolio_id,),
    ).fetchone()
    current_balance = _get_cash_balance(conn, portfolio_id)
    conn.close()
    return {
        "current_balance": round(current_balance, 2),
        "total_deposits": round(row["total_deposits"] or 0, 2),
        "total_withdrawals": round(row["total_withdrawals"] or 0, 2),
        "total_dividends": round(row["total_dividends"] or 0, 2),
        "total_fees": round(row["total_fees"] or 0, 2),
        "net_trade_cash": round(row["net_trade_cash"] or 0, 2),
    }


# ── Corporate Actions ──────────────────────────────────────────────────────

def add_corporate_action(
    portfolio_id: int, code: str, action_type: str, ex_date: str,
    ratio: float = 0, amount: float = 0, notes: str = "",
) -> dict[str, Any]:
    """Record dividend, split, or other corporate action. Auto-adjusts cost basis for splits."""
    conn = get_connection()

    conn.execute(
        """INSERT INTO corporate_actions (portfolio_id, code, action_type, ratio, amount, ex_date, notes)
           VALUES (?,?,?,?,?,?,?)""",
        (portfolio_id, code, action_type, ratio, amount, ex_date, notes),
    )

    if action_type == "split" and ratio > 0:
        pos = conn.execute(
            "SELECT * FROM portfolio_positions WHERE portfolio_id=? AND code=?",
            (portfolio_id, code),
        ).fetchone()
        if pos:
            new_qty = int(pos["quantity"] * ratio)
            new_avg = pos["avg_cost"] / ratio
            conn.execute(
                "UPDATE portfolio_positions SET quantity=?, avg_cost=?, updated_at=datetime('now','localtime') WHERE id=?",
                (new_qty, round(new_avg, 4), pos["id"]),
            )

    if action_type == "dividend" and amount > 0:
        pos = conn.execute(
            "SELECT * FROM portfolio_positions WHERE portfolio_id=? AND code=?",
            (portfolio_id, code),
        ).fetchone()
        if pos:
            total_div = pos["quantity"] * amount
            current_bal = _get_cash_balance(conn, portfolio_id)
            new_bal = current_bal + total_div
            conn.execute(
                "INSERT INTO cash_ledger (portfolio_id, type, amount, balance_after, description) VALUES (?,?,?,?,?)",
                (portfolio_id, "dividend", total_div, new_bal, f"{code} dividend {amount}/share"),
            )

    conn.execute(
        "UPDATE portfolios SET updated_at=datetime('now','localtime') WHERE id=?",
        (portfolio_id,),
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "action_type": action_type, "code": code}


def get_corporate_actions(portfolio_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM corporate_actions WHERE portfolio_id=? ORDER BY ex_date DESC",
        (portfolio_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── CSV Import ─────────────────────────────────────────────────────────────

import csv
import io


def import_transactions_csv(portfolio_id: int, csv_text: str) -> dict[str, Any]:
    """Import transactions from brokerage CSV export.

    Expected columns (flexible mapping):
      code/symbol, name, tx_type/buy_sell, quantity/shares, price, fee/commission, date
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        return {"status": "error", "message": "Empty or invalid CSV"}

    # Normalize column names
    cols = [c.strip().lower() for c in reader.fieldnames]

    def find_col(*aliases: str) -> str | None:
        for a in aliases:
            if a in cols:
                return reader.fieldnames[cols.index(a)]
        return None

    code_col = find_col("code", "symbol", "ticker", "stock_code", "stock code")
    name_col = find_col("name", "stock_name", "stock name", "security")
    type_col = find_col("tx_type", "type", "buy_sell", "side", "action", "transaction_type")
    qty_col = find_col("quantity", "shares", "qty", "volume")
    price_col = find_col("price", "trade_price", "fill_price", "executed_price")
    fee_col = find_col("fee", "commission", "comm", "charges")

    if not code_col:
        return {"status": "error", "message": "Cannot find code/symbol column. Columns: " + ", ".join(cols)}
    if not type_col:
        return {"status": "error", "message": "Cannot find transaction type column"}
    if not qty_col:
        return {"status": "error", "message": "Cannot find quantity column"}
    if not price_col:
        return {"status": "error", "message": "Cannot find price column"}

    imported = 0
    errors: list[str] = []

    for row in reader:
        try:
            code = row[code_col].strip()
            name = row[name_col].strip() if name_col and name_col in row else code
            tx_type_raw = row[type_col].strip().lower()
            qty = int(float(row[qty_col]))
            price = float(row[price_col])
            fee = float(row[fee_col]) if fee_col and fee_col in row else 0

            # Map tx_type
            if tx_type_raw in ("buy", "b", "买入"):
                tx_type = "buy"
            elif tx_type_raw in ("sell", "s", "卖出"):
                tx_type = "sell"
            else:
                errors.append(f"Row {imported + 1}: unknown tx_type '{tx_type_raw}'")
                continue

            add_transaction(portfolio_id, code, name, tx_type, qty, price, fee)
            imported += 1
        except Exception as e:
            errors.append(f"Row {imported + 1}: {e}")

    return {"status": "ok", "imported": imported, "errors": errors}


# ── Risk Reports ───────────────────────────────────────────────────────────

import math


async def get_risk_report(portfolio_id: int) -> dict[str, Any]:
    """Compute risk metrics: VaR, max drawdown, concentration, Sharpe ratio."""
    portfolio = get_portfolio(portfolio_id)
    if not portfolio:
        return {"error": "Portfolio not found"}

    positions = portfolio.get("positions", [])
    if not positions:
        return {
            "var_95": 0, "var_99": 0, "max_drawdown": 0, "max_drawdown_pct": 0,
            "sharpe_ratio": 0, "concentration": [], "nav_history": [],
            "total_value": 0,
        }

    # Get real-time quotes for current value
    codes = [p["code"] for p in positions]
    try:
        quotes = await market_service.batch_quotes(codes)
    except Exception:
        quotes = {}

    total_value = 0.0
    position_values: list[tuple[str, str, float, float]] = []  # code, name, value, pct
    position_codes: list[str] = []

    for pos in positions:
        code = pos["code"]
        qty = pos["quantity"]
        quote = quotes.get(code, {})
        current_price = quote.get("latest_price", 0)
        mv = current_price * qty
        total_value += mv
        position_values.append((code, pos["name"], mv, 0.0))
        position_codes.append(code)

    if total_value <= 0:
        return {"var_95": 0, "var_99": 0, "max_drawdown": 0, "max_drawdown_pct": 0,
                "sharpe_ratio": 0, "concentration": [], "total_value": 0}

    # Concentration (Herfindahl-Hirschman Index and top holdings)
    concentration_data = []
    for code, name, mv, _ in position_values:
        pct = (mv / total_value * 100) if total_value > 0 else 0
        concentration_data.append({"code": code, "name": name, "value": round(mv, 2), "pct": round(pct, 2)})
    concentration_data.sort(key=lambda x: x["pct"], reverse=True)
    hhi = sum(c["pct"] ** 2 for c in concentration_data)

    # Get NAV history for drawdown and Sharpe
    conn = get_connection()
    nav_rows = conn.execute(
        "SELECT * FROM portfolio_nav_history WHERE portfolio_id=? ORDER BY nav_date ASC",
        (portfolio_id,),
    ).fetchall()
    conn.close()
    nav_values = [r["total_value"] for r in nav_rows] if nav_rows else []

    # Max drawdown
    max_dd = 0.0
    max_dd_pct = 0.0
    if len(nav_values) >= 2:
        peak = nav_values[0]
        for v in nav_values:
            if v > peak:
                peak = v
            dd = peak - v
            dd_pct = (dd / peak * 100) if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct

    # Historical VaR (95% and 99%)
    var_95 = 0.0
    var_99 = 0.0
    if len(nav_values) >= 5:
        returns = []
        for i in range(1, len(nav_values)):
            if nav_values[i - 1] > 0:
                r = (nav_values[i] - nav_values[i - 1]) / nav_values[i - 1]
                returns.append(r)
        if returns:
            returns.sort()
            idx_95 = max(0, int(len(returns) * 0.05))
            idx_99 = max(0, int(len(returns) * 0.01))
            var_95 = abs(returns[idx_95]) * total_value
            var_99 = abs(returns[idx_99]) * total_value

    # Sharpe ratio
    sharpe = 0.0
    if len(nav_values) >= 5:
        returns = []
        for i in range(1, len(nav_values)):
            if nav_values[i - 1] > 0:
                r = (nav_values[i] - nav_values[i - 1]) / nav_values[i - 1]
                returns.append(r)
        if returns:
            mean_ret = sum(returns) / len(returns)
            variance = sum((r - mean_ret) ** 2 for r in returns) / len(returns)
            std_ret = math.sqrt(variance)
            if std_ret > 0:
                sharpe = (mean_ret / std_ret) * math.sqrt(252)  # Annualized

    return {
        "total_value": round(total_value, 2),
        "var_95": round(var_95, 2),
        "var_99": round(var_99, 2),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "sharpe_ratio": round(sharpe, 3),
        "hhi": round(hhi, 2),
        "concentration": concentration_data,
        "nav_count": len(nav_values),
    }


def snapshot_nav(portfolio_id: int) -> dict[str, Any]:
    """Save current portfolio NAV snapshot. Call daily or on-demand."""
    import datetime as _dt
    conn = get_connection()
    today = _dt.datetime.now().strftime("%Y-%m-%d")

    positions = conn.execute(
        "SELECT * FROM portfolio_positions WHERE portfolio_id=?",
        (portfolio_id,),
    ).fetchall()
    cash = _get_cash_balance(conn, portfolio_id)

    # Estimate position value from latest known prices via simple sync lookup
    position_value = 0.0
    for pos in positions:
        position_value += pos["quantity"] * pos["avg_cost"]

    total_value = cash + position_value
    portfolio = conn.execute("SELECT initial_capital FROM portfolios WHERE id=?", (portfolio_id,)).fetchone()
    init_cap = portfolio["initial_capital"] if portfolio else 0
    pnl = total_value - init_cap

    conn.execute(
        """INSERT OR REPLACE INTO portfolio_nav_history
           (portfolio_id, nav_date, total_value, cash_balance, position_value, pnl)
           VALUES (?,?,?,?,?,?)""",
        (portfolio_id, today, round(total_value, 2), round(cash, 2), round(position_value, 2), round(pnl, 2)),
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "nav_date": today, "total_value": round(total_value, 2),
            "cash": round(cash, 2), "position_value": round(position_value, 2), "pnl": round(pnl, 2)}
