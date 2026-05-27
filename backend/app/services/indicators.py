from __future__ import annotations


def _ema(values: list[float], period: int) -> list[float]:
    k = 2 / (period + 1)
    result = [values[0]]
    for v in values[1:]:
        result.append(v * k + result[-1] * (1 - k))
    return result


def _sma(values: list[float], period: int) -> list[float]:
    result = [values[0]]
    for v in values[1:]:
        result.append((v + (period - 1) * result[-1]) / period)
    return result


def attach_ma(data: list[dict], closes: list[float]) -> None:
    """Attach MA5/10/20/60 to each bar."""
    for i, item in enumerate(data):
        for p in [5, 10, 20, 60]:
            np_val = min(i + 1, p)
            item[f"ma{p}"] = round(sum(closes[i - np_val + 1:i + 1]) / np_val, 2)


def attach_macd(data: list[dict], closes: list[float]) -> None:
    """Attach DIF/DEA/MACD to each bar."""
    n = len(data)
    if n < 26:
        return
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    dif = [ema12[i] - ema26[i] for i in range(n)]
    dea = _ema(dif, 9)
    for i, item in enumerate(data):
        item["dif"] = round(dif[i], 4)
        item["dea"] = round(dea[i], 4)
        item["macd"] = round(2 * (dif[i] - dea[i]), 4)


def attach_kdj(data: list[dict], highs: list[float], lows: list[float], closes: list[float]) -> None:
    """Attach KDJ(9,3,3) to each bar."""
    n = len(data)
    if n < 9:
        return
    k_vals, d_vals = [50.0], [50.0]
    for i in range(n):
        start = max(0, i - 9 + 1)
        hh = max(highs[start:i + 1])
        ll = min(lows[start:i + 1])
        rsv = ((closes[i] - ll) / (hh - ll) * 100) if hh != ll else (k_vals[-1] if k_vals else 50)
        k_vals.append((rsv + 2 * k_vals[-1]) / 3)
        d_vals.append((k_vals[-1] + 2 * d_vals[-1]) / 3)
    for i in range(n):
        item = data[i]
        item["kdj_k"] = round(k_vals[i + 1], 2)
        item["kdj_d"] = round(d_vals[i + 1], 2)
        item["kdj_j"] = round(3 * k_vals[i + 1] - 2 * d_vals[i + 1], 2)


def attach_rsi(data: list[dict], closes: list[float]) -> None:
    """Attach RSI(6)/RSI(12)/RSI(24) to each bar."""
    n = len(data)
    for rsi_period in [6, 12, 24]:
        if n <= rsi_period:
            continue
        gains, losses = [], []
        for i in range(1, n):
            diff = closes[i] - closes[i - 1]
            gains.append(diff if diff > 0 else 0)
            losses.append(-diff if diff < 0 else 0)
        avg_gain = sum(gains[:rsi_period]) / rsi_period
        avg_loss = sum(losses[:rsi_period]) / rsi_period
        rsi_vals = [0.0] * rsi_period
        rsi_vals.append(100 - 100 / (1 + avg_gain / avg_loss) if avg_loss != 0 else 100)
        for i in range(rsi_period, n - 1):
            avg_gain = (avg_gain * (rsi_period - 1) + gains[i]) / rsi_period
            avg_loss = (avg_loss * (rsi_period - 1) + losses[i]) / rsi_period
            rsi_vals.append(100 - 100 / (1 + avg_gain / avg_loss) if avg_loss != 0 else 100)
        for i in range(n):
            data[i][f"rsi{rsi_period}"] = round(rsi_vals[i], 2) if i < len(rsi_vals) else 0


def attach_boll(data: list[dict], closes: list[float]) -> None:
    """Attach BOLL(20,2) to each bar."""
    n = len(data)
    if n < 20:
        return
    for i in range(19, n):
        window = closes[i - 19:i + 1]
        mean = sum(window) / 20
        variance = sum((v - mean) ** 2 for v in window) / 20
        std = variance ** 0.5
        data[i]["boll_mid"] = round(mean, 2)
        data[i]["boll_up"] = round(mean + 2 * std, 2)
        data[i]["boll_low"] = round(mean - 2 * std, 2)


def attach_all_indicators(data: list[dict]) -> list[dict]:
    """Attach MA, MACD, KDJ, RSI, BOLL to OHLCV bars. Returns same list (mutated in-place)."""
    if not data:
        return data
    closes = [item["close"] for item in data]
    highs = [item["high"] for item in data]
    lows = [item["low"] for item in data]

    attach_ma(data, closes)
    attach_macd(data, closes)
    attach_kdj(data, highs, lows, closes)
    attach_rsi(data, closes)
    attach_boll(data, closes)
    return data
