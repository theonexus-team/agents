UT Bot Dashboard — Build Spec




  UT Bot Dashboard — Build Spec
    Nov 15, 2026       ·   ​@Todd Dowell




  Overview
  We are building one web dashboard that receives UT Bot buy/sell signals from a
  TradingView Pine Script indicator by webhook, shows them for 16 symbols, paper-trades
  them automatically, and pushes alerts to the client's phone. Turning an alert off in
  TradingView stops everything for that symbol, because no webhook is sent.

  In scope

         Pine Script v6 indicator: two UT Bot setups (Setup 1 = Buy, Setup 2 = Sell), 2-minute
         chart, confirmed-bar signals only, JSON webhook
         Dashboard: ETF panel (QQQ and SMH primary, VIX and CL as inverse context), stock
         panel (10 names), signal log, selected-signal detail
         New York session timer shown in Eastern time, highlighting the two trading windows;
         chart signals limited to the NY session (9:30 AM–4:00 PM ET)
         Paper trading engine that opens/closes positions from signals and logs P&L
         Phone alerts that work anywhere (TradingView app push + optional dashboard push)
         Nakshatra context panel, using the client's own mapping table (display only, never
         touches signals)
         Yahoo Finance for live quotes and charts on the dashboard

  Out of scope (v1): futures, live broker execution, multi-user accounts, backtesting UI.

  Trading windows, from the client's brief:


     Window                      Eastern (ET, shown on site + indicator)   Pacific (PT, reference only)

     Opening session             9:30–11:00 AM                             6:30–8:00 AM

     Power hour                  3:00–4:00 PM                              12:00–1:00 PM

     Full NY session             9:30 AM–4:00 PM                           6:30 AM–1:00 PM




                                                                                                          Page 1 of 17
UT Bot Dashboard — Build Spec




  Open questions for the client
  These gaps block final wiring; everything else can be built with placeholders now.

         UT Bot settings. What Key Value and ATR Period does Setup 1 (Buy) use, and Setup 2
         (Sell)? Heikin Ashi source on or off for each? Placeholders in the script: Setup 1 = 1 / 10,
         Setup 2 = 2 / 10 (to confirm).
         Full watchlist. The mockup shows 5 test stocks (AAPL, TSLA, META, AMZN, MU).
         Which are the other 5 of the 10?
         ETF list. Assumed QQQ, SMH, SOXL, SPY, VIX, CL1!. Note VIX is an index and CL1! is
         crude oil futures: they are shown for context only and are never paper-traded.
         Paper-trade direction. Long-only (Buy opens, Sell closes) or flip (Sell also opens a
         short)? Default: long-only.
         Window exit. Should open paper positions auto-close at 11:00 AM and 4:00 PM ET?
         Default: yes.
         Position size. Starting balance is $1,000 (agreed). Default size: 25% of current account
         value per trade, fractional shares. Confirm or change the %.
         TradingView plan. Webhooks need a paid plan and 2-factor authentication. Confirm
         the client's plan, and whether it allows one alert per symbol (16 alerts) or a watchlist
         alert.
         Nakshatra Alert setup. Get a screenshot or export of the client's "Nakshatra Alert"
         TradingView layout so the panel order matches it.


  Architecture and stack
  TradingView decides when a signal fires; the dashboard only receives, stores, paper-
  trades and notifies. Yahoo Finance supplies display prices, never signals.




                                                                                               Page 2 of 17
UT Bot Dashboard — Build Spec




  signal flow · 7 parts

  The phone gets two pushes: TradingView's own app alert, and the dashboard's push after
  the paper engine runs.


     Layer                      Choice                                    Why

     App                        Next.js 15 (App Router, TypeScript)       One repo for UI + API routes

     Hosting                    Vercel                                    HTTPS on port 443 out of the box
                                                                          (TradingView only posts to
                                                                          80/443)

     Database +                 Supabase (Postgres + Realtime)            Signals appear on screen
     realtime                                                             instantly without polling

     Market data                yahoo-finance2 npm package,               Free quotes + intraday bars;
                                server-side only                          cache 15–30 s

     Phone push                 TradingView app (built in) + ntfy.sh or   Works on any network, anywhere
                                Pushover from the server

     UI                         Tailwind + shadcn/ui, Lightweight         Modern look, fast
                                Charts (TradingView's open-source
                                chart lib)

     Time                       date-fns-tz with                          Handles daylight saving
                                America/Los_Angeles and                   automatically
                                America/New_York




                                                                                                         Page 3 of 17
UT Bot Dashboard — Build Spec




  Signal flow: TradingView alert fires on a confirmed 2m bar → POST JSON to
  /api/webhook/tradingview → validate secret, de-duplicate, insert signals row, return
  200 within 3 s → background job runs the paper engine and sends push → Supabase
  Realtime updates every open dashboard.


  Site map
  Five pages and five API routes cover v1.


     Route                           Page / endpoint   What it does

      /                              Live Dashboard    Session timer, Nakshatra panel, ETF
                                                       table, stock table, selected signal,
                                                       phone-alert preview

      /signals                       Signal Log        Every webhook received, filterable by
                                                       symbol, side, window, date; CSV
                                                       export

      /paper                         Paper Trades      Open positions, closed trades, win
                                                       rate, P&L by symbol and by window,
                                                       equity curve

      /symbol/[ticker]               Symbol Detail     Yahoo 2m chart with UT signal
                                                       markers, signal history, trades for that
                                                       symbol




                                                                                           Page 4 of 17
UT Bot Dashboard — Build Spec




     Route                          Page / endpoint   What it does

      /settings                     Settings          Watchlist (16 symbols, sector per
                                                      stock); Paper trading (starting
                                                      balance $1,000, size mode % / $ /
                                                      shares, size value 25%, long-only or
                                                      flip, max open 4, auto-close, fractional
                                                      shares, reset); Trading windows
                                                      (read-only, must match indicator);
                                                      News filter (on/off, impact, minutes
                                                      before/after, source + API key,
                                                      shadow trades, flatten at blackout);
                                                      Nakshatra (auto or manual, ayanamsa,
                                                      Phase 2 filter switches off by default);
                                                      Phone alerts (ntfy / Pushover /
                                                      Telegram, which events push, test);
                                                      TradingView (webhook URL, secret,
                                                      last webhook, indicator version,
                                                      symbols reporting). Sticky Save /
                                                      Discard bar.

      POST                          Webhook           Validates and stores signals (see
     /api/webhook/tradingview       receiver          Webhook contract)

      GET /api/quotes?symbols=      Quotes proxy      Cached Yahoo quotes for the tables

      GET /api/bars/[ticker]        Bars proxy        Cached Yahoo 2m bars for charts

      POST /api/paper/reset         Paper reset       Clears paper account back to starting
                                                      balance

      POST /api/push/test           Push test         Sends a test alert to the phone


  Login: one password-protected account (Supabase Auth or a simple middleware
  password). The webhook route stays public but requires the shared secret.


  Dashboard layout
  Keep the reference mockup's order, top to bottom, but modernize it: dark theme by
  default, card grid, monospace numbers, and colour used only for signal state.




                                                                                          Page 5 of 17
UT Bot Dashboard — Build Spec




     1. Header bar — "UT BOT | ETFs & Stocks", today's date, live ET clock, connection dot
         (green = webhook received in the last 10 min during a window, grey = idle), PAPER
         badge.
     2. Session timer strip — progress bar across 9:30 AM–4:00 PM ET with the two windows
        shaded; countdown to the next window (see Session timer).
     3. Nakshatra context — 8 tiles: today's Moon Nakshatra, auto-calculated, with a
         dropdown to override it (27 options), Ruling planet, Zodiac, Element, Sentiment, Tone
         category, Sector impact, Reference stocks. Data comes from nakshatras.json
         (attached). Stocks in the selected Nakshatra's reference list get a "Reference match"
         star in the tables. Label: "User-provided mapping • independent of UT signals".
     4. Primary focus cards — two large cards for QQQ and SMH: price, % change, latest UT
        signal + age, mini 2m chart. Beside them, two small inverse-context cards for VIX and
         CL with a "Diverging" badge when they move opposite to QQQ/SMH (e.g. QQQ up
         and VIX up).
     5. ETFs & market context table — QQQ, SMH, SOXL, SPY, VIX, CL1!. Columns: Symbol,
        Latest UT, Time / age, Signal price, Move since signal ($ / %), Entry status.
     6. Stocks table — the 10 watchlist stocks, same columns plus Reference match.
     7. Bottom row — Selected signal detail (click any row) and Phone alert preview (exact
        text of the last push).

  Table grouping (same as mockup): "FRESH BUY / SELL" rows first (signal on the latest
  closed 2m bar, i.e. age ≤ 2 min), then "WAIT – previous signals, newest first".

  Status rules


     State                      Rule                                      Colour

     FRESH – Review             Signal age ≤ 2 min                        Green (buy) / red
     setup                                                                (sell)

     WAIT – No new              Older signal, still the latest for that   Amber
     trigger                    symbol

     OUT OF WINDOW              Outside both trading windows              Grey, rows dimmed


  Move since signal = Yahoo last price − signal price, in $ and %. Green when it moves with
  the signal (up after BUY, down after SELL), red when against.




                                                                                              Page 6 of 17
UT Bot Dashboard — Build Spec




  Session timer (Eastern time)
  The timer tracks the New York stock session only and always displays Eastern time (ET),
  computed from America/New_York so daylight-saving changes never shift it.


     State                      ET time (weekdays)         Display

     Pre-market                 Before 9:30 AM             "NY opens in 1h 12m"

     Opening                    9:30–11:00 AM              Green "OPENING SESSION — 58m left",
     window                                                alerts live

     Midday                     11:00 AM–3:00 PM           Grey "Midday — power hour in 2h 4m",
                                                           alerts muted

     Power hour                 3:00–4:00 PM               Green "POWER HOUR — 22m left", alerts
                                                           live

     Closed                     After 4:00 PM, weekends,   "Market closed — opens Mon 9:30 AM ET"
                                holidays


         Ticks every second client-side; no server needed.
         Keep a market_holidays list (NYSE full closures and 1:00 PM ET early closes) in
         config; on early-close days (close at 1:00 PM ET) the indicator's fixed 3:00–4:00 PM
         power hour never fires, so the timer shows "Early close — no power hour" and the
         window-end job closes positions at 1:00 PM ET.
         The same window logic lives in one shared lib/session.ts used by the timer, the
         paper engine and the push filter.


  Pine Script indicator
  One indicator, ut_bot_dual_webhook.pine (attached, Pine v6), runs both UT Bot setups
  on the same chart and sends a JSON webhook on each confirmed signal inside the
  windows. It is an indicator, not a strategy, so it can alert on any symbol; the paper trading
  happens on the dashboard.

  Logic

         UT Bot = ATR trailing stop. Stop distance = Key Value × ATR(ATR Period).
         BUY = price crosses above Setup 1's trailing stop.
         SELL = price crosses below Setup 2's trailing stop.



                                                                                              Page 7 of 17
UT Bot Dashboard — Build Spec




         Fires only on confirmed bar close ( alert.freq_once_per_bar_close ), only on the 2m
         timeframe, only inside 09:30–11:00 and 15:00–16:00 New York time (both toggles in
         Inputs).
         Chart labels: BUY/SELL with price, shown only during the NY session (9:30 AM–4:00
         PM ET). Solid inside the two windows (alerted), faded at midday (no alert), nothing
         pre-market or after hours. Status panel and tooltips show ET.

  Inputs to set per the client: Setup 1 Key Value / ATR / Heikin Ashi, Setup 2 Key Value / ATR
  / Heikin Ashi, shared secret.

  Alert setup in TradingView (per symbol)

     1. Open the symbol on a 2-minute chart and add the indicator.
     2. Create alert → Condition: "UT Bot Dual Setup — Webhook" → "Any alert() function
        call".
     3. Expiration: open-ended. Notifications: tick "Notify in app" (phone push from
         TradingView itself) and "Webhook URL" =
          https://<app>/api/webhook/tradingview .
     4. Repeat for all 16 symbols, or use a watchlist alert if the client's plan offers one.
     5. To stop alerts: pause or delete the alert in TradingView. No alert = no webhook =
        nothing on the dashboard.

  The two alertcondition entries ("UT Bot Buy (Setup 1)", "UT Bot Sell (Setup 2)") are
  there for plain push-only alerts if the client wants them without the dashboard.


  Webhook contract
   POST /api/webhook/tradingview must answer 200 in under 3 seconds; TradingView
  cancels slower requests and does not resend. So the route only validates and inserts, then
  hands the rest to a background step ( waitUntil on Vercel, or a Supabase database
  trigger/edge function).

  Payload the indicator sends:




                                                                                               Page 8 of 17
UT Bot Dashboard — Build Spec




     {
         "secret": "••••",
         "ticker": "AAPL",
         "exchange": "NASDAQ",
         "side": "BUY",
         "setup": "UT1",
         "price": 355.00,
         "tf": "2",
         "bar_time": 1794587760000,
         "bar_close_time": 1794587880000,
         "window": "opening",
         "ut_key": 1,
         "ut_atr_len": 10,
         "ut_heikin": false,
         "ut_stop": 353.42,
         "atr": 1.58,
         "source": "tv_ut_dual_v1.5"
     }


   window is opening , power_hour or midday (midday is never sent while "Only ALERT
  inside trading windows" is on). ut_key , ut_atr_len , ut_heikin , ut_stop and atr
  record the settings that produced the signal; store them on signals and copy them to
   paper_trades so results can later be grouped by setting as well as by Nakshatra. The
  indicator sends no Nakshatra data: the server tags it from bar_close_time (see
  Nakshatra tagging), so there is one source of truth.

  Validation, in order

     1. Body parses as JSON (TradingView sends text/plain , so read raw text, then
          JSON.parse ).
     2. secret equals env WEBHOOK_SECRET , else 401.
     3. ticker is in the watchlist, side is BUY or SELL, tf is "2", else 422.
     4. Optional: source IP is one of TradingView's four (52.89.214.238, 34.212.75.30,
        54.218.53.128, 52.32.178.7).
     5. De-duplicate on (ticker, side, bar_time) with a unique index; a duplicate returns
        200 and does nothing.
     6. Insert into signals , return { ok: true } .

  Then the background step: run the paper engine, send push, write alerts_log . Never
  put passwords or broker keys in the payload.



                                                                                         Page 9 of 17
UT Bot Dashboard — Build Spec




  Data model
  Seven Postgres tables in Supabase (the six below plus econ_events , see News filter;
  signals also carry the news tags); enable Realtime on signals , paper_positions and
   paper_trades .


     Table                      Key columns

      symbols                   ticker (PK), yahoo_symbol, sector, kind ( stock /
                                 etf / context ), is_primary, sort_order, tradeable

      signals                   id, ticker, side, setup, price, tf, bar_time,
                                bar_close_time, window, received_at, raw_json,
                                ut_key, ut_atr_len, ut_heikin, ut_stop, atr, plus the
                                Nakshatra snapshot fields (see Nakshatra
                                tagging); unique (ticker, side, bar_time)

      paper_positions           id, ticker, side ( long / short ), qty, entry_price,
                                entry_signal_id, opened_at

      paper_trades              id, ticker, side, qty, entry_price, exit_price, pnl_usd,
                                pnl_pct, opened_at, closed_at, exit_reason
                                ( opposite_signal / window_end / manual ),
                                entry_signal_id, exit_signal_id, entry Nakshatra
                                snapshot

      settings                  single row: paper_mode ( long_only / flip ),
                                size_mode, size_value, starting_balance,
                                auto_close_at_window_end, push_provider,
                                push_target, selected_nakshatra_id

      alerts_log                id, signal_id, channel, status, sent_at, error


  Seed symbols with the 16 tickers. Yahoo symbol mapping: VIX → ^VIX , CL1! → CL=F ,
  everything else unchanged. Mark VIX and CL1! as context , tradeable = false .



  Nakshatra tagging
  Every signal and every paper trade gets a snapshot of the Nakshatra in force at the
  signal's bar-close time, so results can be grouped by Nakshatra, tone, element, planet and
  reference match later. Tagging is information only: it never blocks or changes a signal in v1.




                                                                                           Page 10 of 17
UT Bot Dashboard — Build Spec




  How a signal is mapped

     1. Take the signal's bar_close_time (the confirmed 2m close).
     2. Compute the Moon's ecliptic longitude at that instant with the astronomy-engine
         npm package (pure JS, runs on Vercel).
     3. Convert to sidereal: subtract the Lahiri ayanamsa (about 24.2° in 2026; compute it
         from the date, don't hard-code it).
     4. Nakshatra number = floor(sidereal longitude ÷ 13°20′) + 1 (1 = Ashwini … 27 = Revati).
        Pada = which quarter of that 13°20′ span (1–4). Moon sign = floor(sidereal longitude ÷
         30°).
     5. Look up that number in nakshatras.json (the client's table) and copy its fields onto
        the signal.

  The Moon stays in one Nakshatra for about a day, so most signals in a session share one,
  but it can change mid-session, which is why each signal is tagged at its own timestamp.
  Put this in lib/nakshatra.ts with unit tests checked against a published panchang for
  5–10 dates.

  Fields stored on each signal (and copied to the paper trade at entry)


     Field                          Example                     Source

     nak_id, nak_name, nak_pada     4, Rohini, 2                Computed

     moon_sign,                     Taurus, 47.3°               Computed
     moon_sidereal_lon

     ruling_planet, zodiac,         Moon, Taurus, Water         Client table
     element

     sentiment, tone                Stable, growth-oriented ·   Client table
                                    Calm

     sector_impact                  Tech, Real Estate           Client table

     reference_match                true (AAPL is in Rohini's   Ticker vs table's stocks
                                    list)

     sector_match                   true / false                symbols.sector vs
                                                                sector_impact

     nak_source                     auto / manual               Manual override from Settings




                                                                                           Page 11 of 17
UT Bot Dashboard — Build Spec




  Optimizing from paper trades: /paper gets a Nakshatra tab showing trades, win rate,
  net P&L and average P&L grouped by tone, element, ruling planet, reference match, sector
  match, window × tone, and Nakshatra. CSV export includes every field. The 3 tones and
  the yes/no matches fill up within weeks; 27 Nakshatras need months of trades before the
  numbers mean much, so the tab shows the trade count next to every bucket.

  Confirm with the client: that his table follows the Moon's Nakshatra, and that he uses the
  Lahiri ayanamsa.

  Roadmap (agreed): Phase 1 (now) tags every trade and reports results; no trade is
  filtered. Phase 2 (after several months of paper trades) reviews the Nakshatra tab and
  hardens the winning combinations into optional filter rules in Settings (for example, skip
  BUYs when tone = Volatile, or require a reference match), each with an on/off switch so
  filtered vs unfiltered results can still be compared.


  Paper trading engine
  Every valid signal on a tradeable symbol inside a window becomes a simulated fill at the
  signal price (the confirmed 2m close), so outcomes match what the client would have
  seen on the alert.


     Event                          Long-only mode (default)              Flip mode

     BUY, flat                      Open long                             Open long

     BUY, long open                 Ignore                                Ignore

     BUY, short open                —                                     Close short, open
                                                                          long

     SELL, flat                     Ignore                                Open short

     SELL, long open                Close long                            Close long, open
                                                                          short

     Window ends (11:00 AM / 4:00   Close at last Yahoo price, reason     Same
     PM ET)                          window_end

     Signal outside window          Logged, never traded                  Same




                                                                                        Page 12 of 17
UT Bot Dashboard — Build Spec




         Size: size_value percent of current account value ÷ entry price, fractional shares to
         4 decimals (default 25%, so up to 4 positions at once); also supports fixed dollars or
         fixed shares if size_mode = shares .
         Starting balance: $1,000 (editable; Reset button on /paper ).
         No slippage or commission in v1; add a settings field later if wanted.
         Window-end job: a cron at 11:00 AM and 4:00 PM ET on trading days (Vercel Cron or
         Supabase pg_cron ) closes open positions.
         Stats on /paper : total P&L, win rate, average win/loss, P&L by window (opening vs
         power hour), P&L by symbol, equity curve, trade list with entry/exit signal links.


  News filter (economic calendar)
  Scheduled US high-impact events are a live filter: a BUY that lands inside a news blackout
  is not paper-traded. Unlike the Nakshatra tags, this rule is active from day one.

  Rule (defaults, editable in Settings)


     Setting                    Default

     Countries                  United States (USD)

     Impact that blocks         High

     Blackout                   10 min before → 10 min after the event time

     What is blocked            New entries (BUY). Exits (SELL, window end)
                                always go through

     Optional                   Flatten open positions at blackout start (off)

     Medium impact              Shown on the dashboard, tagged on signals, does
                                not block


  What happens to a blocked signal: it is stored with status blocked_news , the event name
  and minutes to it; the dashboard row shows "BLOCKED · News" and the dashboard push
  says so ("AAPL | UT BUY | BLOCKED — CPI in 6 min"). The paper engine also records it as a
  shadow trade (same entry/exit rules, not counted in the account) so the Paper page can
  show whether the filter saved or cost money.




                                                                                              Page 13 of 17
UT Bot Dashboard — Build Spec




  Tags on every signal and trade (for later optimizing): news_state (clear / blackout /
  medium_nearby), nearest_event , nearest_impact , minutes_to_event (negative =
  after). The Paper page's insights get a "News" grouping next to Tone and Nakshatra.

  Data source. Keep it behind one lib/econCalendar.ts interface; sync every 15 min into
  an econ_events table (id, source, event_time_utc, country, title, impact, actual, forecast,
  previous, updated_at), and refresh every minute in the 30 min around a High event so
  actuals appear.


     Source                     Cost                    Notes

     FXStreet Economic          Quote from FXStreet     The client's preferred source; official
     Calendar API               sales                   API with OAuth2 tokens and update
                                                        webhooks

     Forex Factory weekly       Free                    Public weekly JSON with impact
     calendar feed                                      levels; unofficial, so add a fallback

     Trading Economics          Paid plans              Calendar API plus websocket updates
     Calendar API                                       on release

     Financial Modeling Prep    From about              Calendar with impact field, 10 years
                                $100/month              of history


  Recommended path: start on the free Forex Factory feed for paper trading, and switch
  the provider to FXStreet once the client has an API agreement. Only the provider file
  changes.

  Congruence note: the TradingView app's own push alert cannot see the news filter, so
  during a blackout the client may still get the TradingView notification. The dashboard
  push and the dashboard row are the source of truth for "take it or not". The Pine Script
  needs no change.

  Calendar sources: FXStreet Economic Calendar API, FXStreet API pricing (not published),
  Forex Factory feed, Trading Economics API, Financial Modeling Prep.


  Phone alerts
  Use two layers so an alert still reaches the phone if the dashboard is down.




                                                                                            Page 14 of 17
UT Bot Dashboard — Build Spec




     1. TradingView app push (primary, zero code). "Notify in app" on each alert. Works
        worldwide on Wi-Fi or mobile data. Pausing the alert in TradingView stops it, which is
        exactly what the client asked for.
     2. Dashboard push (secondary). After a signal is stored, the server sends a push via
        ntfy.sh (free, no account) or Pushover (one-time app fee, very reliable). Provider and
        target are set in /settings , with a Test button.

  Push text format (matches the mockup):

     AAPL | UT BUY | 2m
     9:36 AM ET | Confirmed close $355.00
     Opening session | Paper: opened long 0.724 sh


  Dashboard push only sends for signals inside a window, so midday noise never reaches
  the phone even if an alert was left on.


  Yahoo Finance data
  Yahoo feeds the display only: last price, % change, "move since signal", mini charts and
  window-end exit prices. Signals always come from TradingView.

         Call Yahoo server-side only through /api/quotes and /api/bars/[ticker] using
          yahoo-finance2 ( quote() for prices, chart() with interval: '2m' for bars).
         Cache quotes 15 s and bars 60 s (in-memory or Upstash Redis) so 16 symbols × every
         open tab never hits rate limits.
         The dashboard refreshes quotes every 15 s during windows, every 60 s otherwise.
         Yahoo's API is unofficial: it can change or throttle without notice, and some quotes can
         lag. Show a "price as of hh:mm:ss" stamp and keep the code behind one
          lib/marketData.ts interface so it can be swapped for Polygon, Alpaca or Finnhub
         later.


  Build order for Claude Code
  Put this doc (export as Markdown) in the repo as SPEC.md , add nakshatras.json and
   ut_bot_dual_webhook.pine under /reference , then run these prompts one at a time.

     1. Scaffold. "Read SPEC.md. Create a Next.js 15 TypeScript app with Tailwind and
        shadcn/ui, dark theme default. Add Supabase client, env vars WEBHOOK_SECRET ,
         SUPABASE_URL , SUPABASE_SERVICE_ROLE_KEY , NEXT_PUBLIC_SUPABASE_ANON_KEY ,



                                                                                           Page 15 of 17
UT Bot Dashboard — Build Spec




          PUSH_PROVIDER , PUSH_TARGET . Password-protect all pages except the webhook."
     2. Database. "Write Supabase SQL migrations for the six tables in the Data model
        section, the unique index on signals, Realtime on
        signals/paper_positions/paper_trades, and seed the 16 symbols."
     3. Session logic. "Build lib/session.ts per the Session timer section, with unit tests
        for DST dates, weekends and early closes. Then build the SessionTimer component."
     4. Webhook. "Build POST /api/webhook/tradingview per the Webhook contract.
         Respond in under 3 s; do paper engine + push in waitUntil . Add a scripts/send-
         test-signal.ts that posts a sample payload."
     5. Paper engine. "Build lib/paper.ts per the Paper trading section, with tests for
         every row of the rules table. Add the window-end cron route /api/cron/window-end ,
         guarded by CRON_SECRET ; schedule it in UTC for both PST and PDT and let the route
         itself check ET time."
     6. Market data. "Build lib/marketData.ts on yahoo-finance2 with caching, plus
          /api/quotes and /api/bars/[ticker] ."
     7. Dashboard UI. "Build / per the Dashboard layout section, using Supabase Realtime
         for signals and Lightweight Charts for mini charts. Include the Nakshatra panel from
          reference/nakshatras.json ."
     8. Other pages. "Build /signals , /paper , /symbol/[ticker] and /settings per the
         Site map."
     9. Push. "Add ntfy and Pushover senders behind one sendPush() and the Test button."



  Go-live checklist
         Client's UT Bot settings entered in the indicator inputs
         Final 10 stocks + 6 ETFs seeded in symbols
         TradingView: paid plan, 2-factor authentication on (required for webhooks)
         Indicator added to a 2m chart for each symbol; alert created with "Any alert() function
         call", Notify in app + Webhook URL
          WEBHOOK_SECRET matches the indicator's secret input

          scripts/send-test-signal.ts shows a row on the dashboard and a push on the
         phone
         One live morning watched end to end: signal on chart → row on dashboard → paper fill
         → push → window-end close at 11:00 AM ET




                                                                                          Page 16 of 17
UT Bot Dashboard — Build Spec




         Pausing one alert in TradingView stops that symbol's rows and pushes
         Dashboard and push labelled "Paper trading — not trading advice"

  Sources: TradingView — How to configure webhook alerts (IPs, ports 80/443, 2FA),
  TradingView blog — webhooks for paid users, 3-second timeout.




                                                                                     Page 17 of 17
