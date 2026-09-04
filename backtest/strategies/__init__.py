from __future__ import annotations

from engine.strategy import Strategy

from .algo2_first_touch import Algo2FirstTouchStrategy
from .cisd import CisdStrategy
from .inversion_fvg import InversionFvgStrategy
from .optimal_trade_entry import OptimalTradeEntryStrategy
from .orb_vwap import OrbVwapStrategy
from .power_of_three import PowerOfThreeStrategy
from .silver_bullet import SilverBulletStrategy
from .smoke_test import SmokeTestStrategy
from .turtle_soup import TurtleSoupStrategy

#: Registry mapping a CLI-facing strategy name to its Strategy subclass. To add a new
#: strategy: implement a Strategy subclass in this directory, import it above, and add
#: it here — it becomes available to `python cli.py backtest --strategy <name>`
#: immediately, no other changes needed.
STRATEGIES: dict[str, type[Strategy]] = {
    "smoke_test": SmokeTestStrategy,
    "orb_vwap": OrbVwapStrategy,
    "algo2_first_touch": Algo2FirstTouchStrategy,
    "silver_bullet": SilverBulletStrategy,
    "turtle_soup": TurtleSoupStrategy,
    "inversion_fvg": InversionFvgStrategy,
    "optimal_trade_entry": OptimalTradeEntryStrategy,
    "cisd": CisdStrategy,
    "power_of_three": PowerOfThreeStrategy,
}
