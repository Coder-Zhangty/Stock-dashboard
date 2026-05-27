"""Tests for portfolio_service.py pure functions."""
import pytest
from app.services.portfolio_service import _validate_transaction


class TestValidateTransaction:
    def test_valid_buy(self):
        assert _validate_transaction("buy", 100, 50.0) is None

    def test_valid_sell(self):
        assert _validate_transaction("sell", 50, 30.0) is None

    def test_invalid_type(self):
        err = _validate_transaction("hold", 10, 10.0)
        assert err is not None
        assert "type" in err.lower()

    def test_zero_quantity(self):
        err = _validate_transaction("buy", 0, 50.0)
        assert err is not None

    def test_negative_price(self):
        err = _validate_transaction("buy", 100, -5.0)
        assert err is not None

    def test_negative_quantity(self):
        err = _validate_transaction("sell", -10, 30.0)
        assert err is not None

    def test_all_valid_types(self):
        assert _validate_transaction("buy", 1, 1.0) is None
        assert _validate_transaction("sell", 1, 1.0) is None

    def test_empty_string_type(self):
        err = _validate_transaction("", 10, 10.0)
        assert err is not None

    def test_large_values(self):
        assert _validate_transaction("buy", 1000000, 9999.99) is None

    def test_zero_price(self):
        assert _validate_transaction("buy", 100, 0) is None
