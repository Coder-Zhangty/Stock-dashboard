"""Tests for hk_market_service.py parsing functions."""
import pytest
from app.services.hk_market_service import _parse_single_hk_line


class TestParseHKLine:
    def test_invalid_line_none(self):
        import asyncio
        result = asyncio.run(_parse_single_hk_line("00700", ""))
        assert result is None

    def test_no_quotes(self):
        import asyncio
        result = asyncio.run(_parse_single_hk_line("00700", "no quotes here"))
        assert result is None

    def test_too_short_parts(self):
        import asyncio
        line = 'v_hk00700="1~Tencent~00700~385.00~380.00~384.00"'
        result = asyncio.run(_parse_single_hk_line("00700", line))
        assert result is None

    def test_valid_line(self):
        import asyncio
        parts = ["1", "Tencent", "00700", "385.00", "380.00", "384.00",
                 "1000000", "0", "0", "0"] + ["0"] * 41
        line = 'v_hk00700="' + "~".join(parts) + '"'
        result = asyncio.run(_parse_single_hk_line("00700", line))
        assert result is not None
        assert result["code"] == "00700"
        assert result["name"] == "Tencent"
        assert result["latest_price"] == 385.00
        assert result["prev_close"] == 380.00
        assert result["open"] == 384.00

    def test_zero_prev_close(self):
        import asyncio
        parts = ["1", "Test", "00001", "100.00", "0"] + ["0"] * 46
        line = 'v_hk00001="' + "~".join(parts) + '"'
        result = asyncio.run(_parse_single_hk_line("00001", line))
        assert result is not None
        assert result["change_pct"] == 0
        assert result["change_amount"] == 100.0  # price - 0 = price

    def test_missing_optional_fields(self):
        import asyncio
        parts = ["1", "Stock", "00005", "50.00", "49.00", "50.50"] + ["0"] * 44
        line = 'v_hk00005="' + "~".join(parts) + '"'
        result = asyncio.run(_parse_single_hk_line("00005", line))
        assert result is not None
        assert result["latest_price"] == 50.00
