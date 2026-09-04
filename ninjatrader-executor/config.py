"""Config loaded from .env — see .env.example. Refuses to start with placeholder
values for anything that would place a real order against the wrong account/
instrument, since a typo here means real money on the wrong thing."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.environ.get("API_BASE_URL", "https://theonexus-trading-oracle.vercel.app")
EXECUTION_SECRET = os.environ.get("EXECUTION_SECRET", "")

# Defaults to true. Flip to false only once you've watched a full dry-run cycle in
# the logs and are confident the instrument map / account name are correct — this
# is the same "prove it in paper first" precedent as kalshi-trader's PAPER_MODE.
DRY_RUN = os.environ.get("DRY_RUN", "true").lower() == "true"

NT_ACCOUNT = os.environ.get("NT_ACCOUNT", "")

# NinjaTrader needs the full contract-specific instrument name (e.g. "MGCZ26"), not
# the bare root symbol — and this changes every quarterly roll. Format in .env:
# INSTRUMENT_MGC=MGCZ26
INSTRUMENT_MAP = {
    "MGC": os.environ.get("INSTRUMENT_MGC", ""),
    "HG": os.environ.get("INSTRUMENT_HG", ""),
    "MNQ": os.environ.get("INSTRUMENT_MNQ", ""),
}

# Documents\NinjaTrader 8 by default — override if NinjaTrader is installed
# somewhere unusual.
_default_nt_dir = Path.home() / "Documents" / "NinjaTrader 8"
NT_DIR = Path(os.environ.get("NT_DIR", str(_default_nt_dir)))
INCOMING_DIR = NT_DIR / "incoming"
OUTGOING_DIR = NT_DIR / "outgoing"

POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "3"))
FILL_TIMEOUT_SECONDS = float(os.environ.get("FILL_TIMEOUT_SECONDS", "60"))

STATE_FILE = Path(__file__).parent / "state.json"


def validate() -> list[str]:
    """Returns a list of problems. Empty list = safe to start."""
    problems = []
    if not EXECUTION_SECRET:
        problems.append("EXECUTION_SECRET is not set")
    if not NT_ACCOUNT:
        problems.append("NT_ACCOUNT is not set — check the Accounts tab in Control Center for the exact name")
    for symbol, contract in INSTRUMENT_MAP.items():
        if not contract:
            problems.append(f"INSTRUMENT_{symbol} is not set — needed for {symbol} to trade")
    if not DRY_RUN:
        if not INCOMING_DIR.exists():
            problems.append(f"incoming folder does not exist: {INCOMING_DIR} — is NinjaTrader installed here, and has ATI been enabled?")
        if not OUTGOING_DIR.exists():
            problems.append(f"outgoing folder does not exist: {OUTGOING_DIR} — same as above")
    return problems
