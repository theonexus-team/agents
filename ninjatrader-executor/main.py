from __future__ import annotations

import logging
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

import client
import config
import executor

# Windows consoles often default to a codepage that can't render em-dashes and
# other punctuation used in log messages/docstrings throughout this project —
# garbles output rather than erroring, so easy to miss. UTF-8 fixes it outright.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(LOG_DIR / "ninjatrader-executor.log", maxBytes=10_000_000, backupCount=5),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("ninjatrader-executor.main")


def poll_loop() -> None:
    logger.info(
        "Starting NinjaTrader executor. DRY_RUN=%s, account=%s, instruments=%s",
        config.DRY_RUN, config.NT_ACCOUNT or "(unset)", config.INSTRUMENT_MAP,
    )
    while True:
        try:
            intents = client.fetch_pending()
            for intent in intents:
                executor.process_intent(intent)
        except Exception:
            logger.exception("poll cycle failed, continuing")
        time.sleep(config.POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    problems = config.validate()
    if problems:
        logger.error("Refusing to start — config problems:")
        for p in problems:
            logger.error("  - %s", p)
        raise SystemExit(1)

    if config.DRY_RUN:
        logger.warning(
            "DRY_RUN is on — no real orders will be placed, no OIF files will be "
            "written. Fills are faked instantly at price 0.0 so you can verify the "
            "poll/report loop end-to-end. Set DRY_RUN=false in .env once you've "
            "confirmed this looks right in the logs."
        )

    while True:
        try:
            poll_loop()
        except KeyboardInterrupt:
            break
        except Exception:
            logger.exception("poll_loop() crashed, restarting in 10s")
            time.sleep(10)
