from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class PushChannel(ABC):
    """Abstract base for push notification channels."""

    name: str = "base"

    @abstractmethod
    async def send(self, title: str, content: str) -> bool:
        """Send a notification. Returns True on success."""
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if this channel has valid configuration."""
        ...
