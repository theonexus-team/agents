# ninjatrader-executor

Local watcher that turns the primary Theonexus dashboard's trade signals into real
orders in NinjaTrader, and reports the real fills back so the dashboard reflects
what actually happened — not what the Pine strategy calculated.

## How it fits together

1. TradingView's Pine script (`theonexus-orb-breakout.pine`) still computes entries,
   stops, targets, exits — nothing about the strategy logic changes.
2. Its alert still hits `/api/webhook/tradingview` like always. But once
   `EngineState.liveExecutionMode` is on, that endpoint stops creating paper
   `OpenPosition`/`Trade` rows directly from Pine's numbers — it queues an
   `ExecutionIntent` instead.
3. **This process** polls `/api/execution/pending` every few seconds, and for each
   intent:
   - **entry**: places a real market order in NinjaTrader via ATI, waits for the fill,
     then reports the real fill price to `/api/execution/report` — THAT'S what
     creates the dashboard's real `OpenPosition`/`Trade` row.
   - **exit**: looks up what's actually open (from this process's own local
     `state.json`), places the opposite-side order to flatten it, waits for the fill,
     reports the real exit price the same way.
4. NinjaTrader's ATI is entirely file-based — no NinjaScript/C# involved. Commands
   are dropped into `Documents\NinjaTrader 8\incoming\`, fill confirmations come back
   as text files in `Documents\NinjaTrader 8\outgoing\`.

## One-time NinjaTrader setup (you do this by hand — I can't see your screen)

1. **Connect NinjaTrader** to your data/execution provider: Control Center →
   Connections → Connect. Confirm it shows Connected. **Use a simulation account
   while you're testing this** — do not point it at a funded/live account until
   you've watched several full cycles work correctly. Check the Accounts tab in
   Control Center for the exact name(s) — this isn't always "Sim101"; a broker-
   provided sim account (Rithmic, etc.) will have its own ID format instead.
2. **Enable ATI**: Control Center → Tools → Options → "Automated trading interface"
   category → turn on **AT Interface**, set **Default account** to your sim account.
   This creates the `incoming`/`outgoing` folders under `Documents\NinjaTrader 8\` if
   they don't already exist.
3. **Note your exact account name** from the Accounts tab (step 1).
4. **Look up the current front-month contract name** for each instrument you trade
   (MGC, HG, MNQ): File → New → Chart, type the root symbol into the instrument
   search box, and note the exact string NinjaTrader shows. Format is `ROOT MM-YY`
   (e.g. `MGC 12-26`), not the older futures month-code format. **These need updating
   every quarterly roll** — nothing here does that automatically.

## Setup on this machine

```bash
cd ninjatrader-executor
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
```

Edit `.env`: paste in `EXECUTION_SECRET` (from the Vercel project's
`EXECUTION_REPORTER_SECRET` env var), `NT_ACCOUNT`, and the three `INSTRUMENT_*`
contract codes from step 4 above. Leave `DRY_RUN=true`.

Run it:

```bash
.venv\Scripts\python main.py
```

With `DRY_RUN=true`, it polls for real intents and logs what it *would* do, but
writes no OIF files and fakes an instant fill at price 0.0 — this lets you verify the
poll → report round-trip works before anything touches NinjaTrader. It won't do
anything at all until `EngineState.liveExecutionMode` is turned on from the primary
dashboard's Engine Controls panel (admin desk key required, with a confirm step)
**and** a real Pine signal fires — those two together are what actually creates
`ExecutionIntent` rows for it to find.

Once you've watched a full dry-run cycle succeed in the logs, set `DRY_RUN=false` and
restart. Test against your simulation account for a while before ever pointing
`NT_ACCOUNT` at a funded account.

## Persistence (optional — not installed automatically)

Same pattern as `kalshi-trader/`: `run_forever_hidden.vbs` launches `run_forever.cmd`
with no visible window. To have it start automatically at Windows logon, copy
(don't move) `run_forever_hidden.vbs` into:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
```

Task Scheduler is blocked on this machine (confirmed in an earlier session), so this
Startup-folder approach is the working option. It starts at login and survives the
terminal/chat session ending, but does **not** survive a full shutdown with nobody
logged in. `main.py` has its own crash-restart loop, so process-level supervision
beyond "does Windows start it at login" isn't critical.

## What happens if the PC/watcher is down when a signal fires

Three things need to be running for a real order to place: this PC (on, logged in —
Startup-folder persistence starts at login, not at boot with nobody logged in),
NinjaTrader itself (open and connected — nothing auto-starts it), and this watcher.
If any of those are down, TradingView's signal still reaches the cloud webhook fine
and gets queued — it isn't lost. What happens next depends on entry vs exit:

- **Entry intents older than 5 minutes are auto-expired server-side** (see
  `STALE_ENTRY_MS` in `src/app/api/execution/pending/route.ts`) and never handed to
  this watcher at all — firing a fresh position hours late, at a completely
  different price than Pine actually saw, would be actively dangerous.
- **Exit intents never expire.** A stale exit still gets processed as soon as the
  watcher comes back — closing a real open position late is always better than
  leaving it unmanaged in NinjaTrader indefinitely.

## Known risks — read before running unattended

- **Fill-confirmation timeout ≠ no fill.** If `outgoing/{orderId}.txt` doesn't reach
  a terminal state within `FILL_TIMEOUT_SECONDS`, this process does NOT report
  anything and does NOT assume success or failure — it logs and retries on the next
  poll (server-side, a claimed-but-unreported intent becomes reclaimable after 2
  minutes). If the order actually DID fill in NinjaTrader but the confirmation file
  read failed or was slow, retrying could place a **second, duplicate real order**.
  This is the single biggest risk in this design. Mitigate by watching the logs
  closely early on, and by periodically checking NinjaTrader's own position against
  what the dashboard thinks is open.
- **Exit relies on local `state.json`, not NinjaTrader's live position.** If this
  process is restarted and loses track of what's open (or a position was closed
  manually in NinjaTrader outside this pipeline), an exit intent will refuse to
  guess and raise instead of placing a wrong-sized flatten — logged as CRITICAL. You
  will need to reconcile manually when that happens.
- **A persistently-failing intent stops retrying after 3 attempts** (e.g. a typo'd
  instrument code) and logs CRITICAL — it will NOT loop forever hammering
  NinjaTrader, but it also will NOT resolve itself. Check the logs.
- **Contract roll is manual.** `INSTRUMENT_MGC`/`HG`/`MNQ` in `.env` need updating
  by hand each quarter — nothing here reads NinjaTrader's own front-month
  automatically.
