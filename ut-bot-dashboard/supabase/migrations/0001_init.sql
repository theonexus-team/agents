-- UT Bot Dashboard — initial schema. Run once in the Supabase SQL editor.

create table if not exists symbols (
  ticker text primary key,
  yahoo_symbol text not null,
  sector text not null default '',
  kind text not null check (kind in ('stock','etf','context')),
  is_primary boolean not null default false,
  sort_order int not null default 0,
  tradeable boolean not null default true
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null references symbols(ticker),
  side text not null check (side in ('BUY','SELL')),
  setup text not null,
  price numeric not null,
  tf text not null,
  bar_time bigint not null,
  bar_close_time bigint not null,
  "window" text not null,
  status text not null default 'accepted', -- accepted | outside_window | blocked_news | context_only
  received_at timestamptz not null default now(),
  raw_json jsonb not null,
  ut_key numeric, ut_atr_len int, ut_heikin boolean, ut_stop numeric, atr numeric,
  -- Nakshatra snapshot
  nak_id int, nak_name text, nak_pada int, moon_sign text, moon_sidereal_lon numeric,
  ruling_planet text, zodiac text, element text, sentiment text, tone text,
  sector_impact text[], reference_match boolean, sector_match boolean, nak_source text,
  -- News tags
  news_state text default 'clear', nearest_event text, nearest_impact text, minutes_to_event int
);
create unique index if not exists signals_dedupe on signals (ticker, side, bar_time);
create index if not exists signals_recent on signals (bar_close_time desc);

create table if not exists paper_positions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null references symbols(ticker),
  side text not null check (side in ('long','short')),
  qty numeric not null,
  entry_price numeric not null,
  entry_signal_id uuid references signals(id),
  opened_at timestamptz not null default now(),
  shadow boolean not null default false
);

create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  ticker text not null references symbols(ticker),
  side text not null check (side in ('long','short')),
  qty numeric not null,
  entry_price numeric not null,
  exit_price numeric not null,
  pnl_usd numeric not null,
  pnl_pct numeric not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null default now(),
  exit_reason text not null check (exit_reason in ('opposite_signal','window_end','manual','news_flatten')),
  entry_signal_id uuid references signals(id),
  exit_signal_id uuid references signals(id),
  "window" text,
  shadow boolean not null default false,
  ut_key numeric, ut_atr_len int, ut_heikin boolean,
  nak_id int, nak_name text, nak_pada int, ruling_planet text, zodiac text, element text,
  sentiment text, tone text, sector_impact text[], reference_match boolean, sector_match boolean, nak_source text,
  news_state text, nearest_event text, minutes_to_event int
);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  paper_mode text not null default 'long_only' check (paper_mode in ('long_only','flip')),
  size_mode text not null default 'percent' check (size_mode in ('percent','dollars','shares')),
  size_value numeric not null default 25,
  starting_balance numeric not null default 1000,
  max_open int not null default 4,
  auto_close_at_window_end boolean not null default true,
  fractional_shares boolean not null default true,
  push_provider text not null default 'ntfy',
  push_target text,
  selected_nakshatra_id int,
  news_filter_enabled boolean not null default true,
  news_block_impact text not null default 'High',
  news_minutes_before int not null default 10,
  news_minutes_after int not null default 10,
  news_flatten_at_blackout boolean not null default false,
  -- Options risk plan (client, Nov 15 2026). Percentages of premium.
  instrument text not null default 'options' check (instrument in ('options','shares')),
  option_trade_usd numeric not null default 250,
  option_stop_pct numeric not null default 20,
  option_targets_pct numeric[] not null default '{40,75,100}',
  option_target_exit_fractions numeric[] not null default '{0.3333,0.3333,0.3334}',
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists alerts_log (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id),
  channel text not null,
  status text not null,
  sent_at timestamptz not null default now(),
  error text
);

create table if not exists econ_events (
  id text primary key,
  source text not null,
  event_time_utc timestamptz not null,
  country text not null,
  title text not null,
  impact text not null,
  actual text, forecast text, previous text,
  updated_at timestamptz not null default now()
);
create index if not exists econ_events_time on econ_events (event_time_utc);

-- Realtime
alter publication supabase_realtime add table signals, paper_positions, paper_trades;

-- RLS: the browser only reads (anon key); all writes go through the server with the service role.
alter table symbols enable row level security;
alter table signals enable row level security;
alter table paper_positions enable row level security;
alter table paper_trades enable row level security;
alter table settings enable row level security;
alter table alerts_log enable row level security;
alter table econ_events enable row level security;
create policy "read" on symbols for select using (true);
create policy "read" on signals for select using (true);
create policy "read" on paper_positions for select using (true);
create policy "read" on paper_trades for select using (true);
create policy "read" on econ_events for select using (true);

-- Seed: 6 ETFs/context + 5 confirmed stocks. Add the client's other 5 stocks when known.
insert into symbols (ticker, yahoo_symbol, sector, kind, is_primary, sort_order, tradeable) values
  ('QQQ','QQQ','Tech','etf',true,1,true),
  ('SMH','SMH','Semiconductors','etf',true,2,true),
  ('SOXL','SOXL','Semiconductors','etf',false,3,true),
  ('SPY','SPY','Broad market','etf',false,4,true),
  ('VIX','^VIX','Volatility','context',false,5,false),
  ('CL1!','CL=F','Energy','context',false,6,false),
  ('AAPL','AAPL','Tech','stock',false,10,true),
  ('TSLA','TSLA','Auto','stock',false,11,true),
  ('META','META','Tech','stock',false,12,true),
  ('AMZN','AMZN','Cloud','stock',false,13,true),
  ('MU','MU','Semiconductors','stock',false,14,true),
  ('AVGO','AVGO','Semiconductors','stock',false,15,true),
  ('CRWD','CRWD','Software','stock',false,16,true),
  ('GOOGL','GOOGL','Tech','stock',false,17,true),
  ('MSFT','MSFT','Tech','stock',false,18,true),
  ('NVDA','NVDA','Semiconductors','stock',false,19,true)
on conflict (ticker) do nothing;
