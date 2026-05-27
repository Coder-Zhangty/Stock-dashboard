"""Tests for market_service.py core functions."""
import pytest
from app.services.market_service import _sina_symbol, _tencent_symbol, _parse_sina_quote


class TestSinaSymbol:
    def test_shanghai_stock(self):
        assert _sina_symbol("600519") == "sh600519"

    def test_shenzhen_stock(self):
        assert _sina_symbol("000001") == "sz000001"

    def test_star_market(self):
        assert _sina_symbol("688001") == "sh688001"

    def test_beijing(self):
        assert _sina_symbol("920001") == "sh920001"


class TestTencentSymbol:
    def test_shanghai_stock(self):
        assert _tencent_symbol("600519") == "sh600519"

    def test_shenzhen_stock(self):
        assert _tencent_symbol("000001") == "sz000001"


class TestParseSinaQuote:
    def test_invalid_input(self):
        assert _parse_sina_quote("") is None
        assert _parse_sina_quote("invalid") is None

    def test_short_parts(self):
        result = _parse_sina_quote('var hq_str_sh000001="too,short"')
        assert result is None

    def test_valid_quote(self):
        parts = ["贵州茅台", "1800.00", "1790.00", "1795.00", "1810.00", "1780.00",
                 "100000", "180000000", "0", "0", "1800.00", "100", "1799.00", "200"]
        parts += ["0"] * 20  # pad to 32+
        line = 'var hq_str_sh600519="' + ",".join(parts) + '"'
        result = _parse_sina_quote(line)
        assert result is not None
        assert result["name"] == "贵州茅台"
        assert result["open"] == 1800.0
        assert result["prev_close"] == 1790.0
        assert result["latest_price"] == 1795.0
        assert result["high"] == 1810.0
        assert result["low"] == 1780.0


class TestCacheFunctions:
    def test_cache_set_and_get(self):
        from app.services.market_service import _set_cache, _get_cached
        _set_cache("test_key", {"value": 42})
        result = _get_cached("test_key", 9999)
        assert result == {"value": 42}

    def test_cache_expiry(self):
        import time
        from app.services.market_service import _set_cache, _get_cached
        _set_cache("test_ttl", "data")
        # Test non-expired
        result = _get_cached("test_ttl", 9999)
        assert result == "data"
        # Test expired
        from app.services.market_service import _cache
        _cache["test_ttl"] = (time.time() - 10, "data")
        result = _get_cached("test_ttl", 5.0)
        assert result is None
