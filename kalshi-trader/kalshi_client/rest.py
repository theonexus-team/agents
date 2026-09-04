from __future__ import annotations

import uuid
from typing import Any, Literal, Optional
from urllib.parse import urlparse

import requests

import config
from kalshi_client.auth import auth_headers

BookSide = Literal["bid", "ask"]

_PATH_PREFIX = urlparse(config.BASE_URL).path  # "/trade-api/v2"


def _sign_path(path: str) -> str:
    return _PATH_PREFIX + path


def _request(method: str, path: str, params: Optional[dict] = None, json_body: Optional[dict] = None) -> dict[str, Any]:
    headers = auth_headers(method, _sign_path(path))
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    resp = requests.request(method, config.BASE_URL + path, headers=headers, params=params, json=json_body, timeout=10)
    if not resp.ok:
        raise KalshiApiError(resp.status_code, resp.text)
    return resp.json() if resp.text else {}


class KalshiApiError(RuntimeError):
    def __init__(self, status_code: int, body: str):
        super().__init__(f"Kalshi API error {status_code}: {body}")
        self.status_code = status_code
        self.body = body


def get_balance() -> int:
    """Returns balance in cents."""
    return _request("GET", "/portfolio/balance")["balance"]


def list_open_markets(series_ticker: str = config.SERIES_TICKER, limit: int = 50) -> list[dict[str, Any]]:
    data = _request("GET", "/markets", params={"series_ticker": series_ticker, "status": "open", "limit": limit})
    return data.get("markets", [])


def get_orderbook(ticker: str, depth: int = 10) -> dict[str, Any]:
    return _request("GET", f"/markets/{ticker}/orderbook", params={"depth": depth})


def get_market(ticker: str) -> dict[str, Any]:
    return _request("GET", f"/markets/{ticker}")["market"]


def create_order(
    ticker: str,
    side: BookSide,
    count: int,
    price_dollars: str,
    time_in_force: str = "immediate_or_cancel",
    client_order_id: Optional[str] = None,
) -> dict[str, Any]:
    """side='bid' buys YES, side='ask' sells YES (opening an 'ask' without a prior
    YES holding is Kalshi's mechanism for taking a NO-equivalent short position,
    per docs.kalshi.com's BookSide description). Uses the V2 endpoint
    (/portfolio/events/orders) per Kalshi's own current quickstart example."""
    body = {
        "ticker": ticker,
        "side": side,
        "count": f"{count:.2f}",
        "price": price_dollars,
        "time_in_force": time_in_force,
        "self_trade_prevention_type": "taker_at_cross",
        "client_order_id": client_order_id or str(uuid.uuid4()),
    }
    return _request("POST", "/portfolio/events/orders", json_body=body)["order"]


def cancel_order(order_id: str) -> dict[str, Any]:
    return _request("DELETE", f"/portfolio/events/orders/{order_id}")


def get_positions() -> list[dict[str, Any]]:
    return _request("GET", "/portfolio/positions").get("market_positions", [])


def get_fills(order_id: Optional[str] = None) -> list[dict[str, Any]]:
    params = {"order_id": order_id} if order_id else None
    return _request("GET", "/portfolio/fills", params=params).get("fills", [])
