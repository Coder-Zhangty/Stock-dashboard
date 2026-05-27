"""断路器 — 连续失败自动熔断，冷却后探活"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Callable

logger = logging.getLogger(__name__)


class CircuitState(StrEnum):
    CLOSED = "closed"          # 正常通行
    OPEN = "open"              # 熔断，拒绝请求
    HALF_OPEN = "half_open"    # 探活：允许一个请求通过


class CircuitOpenError(Exception):
    """断路器熔断中"""


@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    cooldown_seconds: float = 60.0
    half_open_timeout: float = 10.0

    failure_count: int = field(default=0, init=False)
    last_failure_time: float = field(default=0, init=False)
    last_success_time: float = field(default=0, init=False)
    state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    name: str = ""

    def _check_state(self) -> None:
        if self.state == CircuitState.CLOSED:
            return
        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self.last_failure_time
            if elapsed >= self.cooldown_seconds:
                self.state = CircuitState.HALF_OPEN
                logger.info("断路器 [%s] 进入半开状态，尝试探活", self.name)
            else:
                raise CircuitOpenError(
                    f"断路器 [{self.name}] 熔断中 ({elapsed:.0f}s / {self.cooldown_seconds:.0f}s)"
                )
        # HALF_OPEN → 放行一个请求

    def on_success(self) -> None:
        self.failure_count = 0
        self.last_success_time = time.time()
        if self.state != CircuitState.CLOSED:
            logger.info("断路器 [%s] 恢复，关闭", self.name)
        self.state = CircuitState.CLOSED

    def on_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(
                "断路器 [%s] 熔断！连续 %d 次失败，冷却 %d 秒",
                self.name, self.failure_count, int(self.cooldown_seconds),
            )
        else:
            logger.debug("断路器 [%s] 失败计数: %d/%d", self.name, self.failure_count, self.failure_threshold)

    async def call(self, fn: Callable, *args: Any, timeout: float = 15.0, **kwargs: Any) -> Any:
        """包装异步调用，自动处理熔断/恢复"""
        self._check_state()
        try:
            result = await fn(*args, **kwargs)
            self.on_success()
            return result
        except CircuitOpenError:
            raise
        except Exception:
            self.on_failure()
            raise
