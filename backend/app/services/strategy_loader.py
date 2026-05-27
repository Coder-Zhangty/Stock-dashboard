"""策略加载器 — 加载 YAML 策略文件并提供查询接口"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


@dataclass
class Strategy:
    name: str
    aliases: list[str] = field(default_factory=list)
    category: str = ""
    description: str = ""
    judgment_criteria: str = ""
    base_score: int = 50
    bonuses: list[dict] = field(default_factory=list)
    penalties: list[dict] = field(default_factory=list)
    tools_required: list[str] = field(default_factory=list)
    risk_level: str = "medium"
    hold_period: str = ""

    def match_name(self, query: str) -> bool:
        """Check if query matches strategy name or aliases."""
        q = query.lower().strip()
        if q in self.name.lower():
            return True
        for alias in self.aliases:
            if q in alias.lower():
                return True
        return False

    @property
    def id(self) -> str:
        """Safe filename stem for this strategy."""
        import re
        safe = re.sub(r'[^\w]', '_', self.name)
        return safe.lower()


class StrategyLoader:
    """Load and query strategy YAML files."""

    def __init__(self, strategies_dir: str | None = None):
        self._strategies: list[Strategy] = []
        self._name_index: dict[str, Strategy] = {}
        self._by_category: dict[str, list[Strategy]] = {}
        if strategies_dir:
            self.load(strategies_dir)

    def load(self, strategies_dir: str) -> list[Strategy]:
        """Load all .yaml files from directory."""
        path = Path(strategies_dir)
        if not path.exists():
            logger.warning("Strategies directory not found: %s", strategies_dir)
            return []

        loaded = []
        for yaml_file in sorted(path.glob("*.yaml")):
            try:
                with open(yaml_file, encoding="utf-8") as f:
                    raw = yaml.safe_load(f)
                s = Strategy(
                    name=raw.get("name", yaml_file.stem),
                    aliases=raw.get("aliases", []),
                    category=raw.get("category", ""),
                    description=str(raw.get("description", "")).strip(),
                    judgment_criteria=str(raw.get("judgment_criteria", "")).strip(),
                    base_score=int(raw.get("scoring", {}).get("base_score", 50)),
                    bonuses=raw.get("scoring", {}).get("bonuses", []),
                    penalties=raw.get("scoring", {}).get("penalties", []),
                    tools_required=raw.get("tools_required", []),
                    risk_level=raw.get("risk_level", "medium"),
                    hold_period=raw.get("hold_period", ""),
                )
                loaded.append(s)
                self._name_index[s.name] = s
                for alias in s.aliases:
                    self._name_index[alias] = s
                self._by_category.setdefault(s.category, []).append(s)
            except Exception as e:
                logger.warning("Failed to load strategy %s: %s", yaml_file.name, e)

        self._strategies = loaded
        logger.info("Loaded %d strategies from %s", len(loaded), strategies_dir)
        return loaded

    @property
    def strategies(self) -> list[Strategy]:
        return list(self._strategies)

    def find(self, query: str) -> Strategy | None:
        """Find a strategy by name or alias. Returns None if not found."""
        return self._name_index.get(query)

    def search(self, query: str) -> list[Strategy]:
        """Fuzzy search strategies by name/alias."""
        results = []
        q = query.lower().strip()
        for s in self._strategies:
            if s.match_name(q):
                results.append(s)
        return results

    def by_category(self, category: str) -> list[Strategy]:
        return self._by_category.get(category, [])

    def categories(self) -> list[str]:
        return list(self._by_category.keys())

    def list_names(self) -> list[str]:
        return [s.name for s in self._strategies]


# Global singleton
strategy_loader = StrategyLoader()
