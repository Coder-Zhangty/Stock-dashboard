"""Tests for email_service.py token operations."""
import pytest
from app.services.email_service import generate_token


class TestGenerateToken:
    def test_token_length(self):
        token = generate_token()
        assert len(token) >= 32

    def test_token_uniqueness(self):
        tokens = {generate_token() for _ in range(50)}
        assert len(tokens) == 50

    def test_token_urlsafe(self):
        token = generate_token()
        assert "/" not in token
        assert "+" not in token

    def test_token_is_string(self):
        token = generate_token()
        assert isinstance(token, str)

    def test_token_not_empty(self):
        token = generate_token()
        assert len(token) > 0
