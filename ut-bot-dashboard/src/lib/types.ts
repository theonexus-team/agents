import type { NakshatraSnapshot } from "./nakshatra";

export type Side = "BUY" | "SELL";
export type SignalStatus = "accepted" | "outside_window" | "blocked_news" | "context_only";

export interface Signal extends NakshatraSnapshot {
  id: string;
  ticker: string;
  side: Side;
  setup: string;
  price: number;
  tf: string;
  bar_time: number;
  bar_close_time: number;
  window: "opening" | "power_hour" | "midday" | "outside";
  received_at: string;
  status: SignalStatus;
  ut_key: number | null;
  ut_atr_len: number | null;
  ut_heikin: boolean | null;
  ut_stop: number | null;
  atr: number | null;
  news_state: "clear" | "blackout" | "medium_nearby";
  nearest_event: string | null;
  minutes_to_event: number | null;
  sample?: boolean;
}
