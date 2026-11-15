/**
 * One place that knows which outside accounts are configured. Nothing here
 * makes a network call — it only checks whether credentials exist, so the app
 * runs on sample data until each account is connected.
 */
import { lastWebhookAt } from "./store";

export type ConnStatus = "connected" | "missing" | "no_account_needed" | "later";

export interface Connection {
  id: string;
  name: string;
  purpose: string;
  required: boolean;
  status: ConnStatus;
  signupUrl?: string;
  steps: string[];
  envVars: { name: string; set: boolean; secret: boolean }[];
}

const has = (k: string) => !!process.env[k] && process.env[k]!.trim() !== "";
const vars = (names: [string, boolean][]) => names.map(([name, secret]) => ({ name, set: has(name), secret }));

export function getConnections(): Connection[] {
  const pushProvider = (process.env.PUSH_PROVIDER || "ntfy").toLowerCase();
  const pushVars: [string, boolean][] =
    pushProvider === "pushover" ? [["PUSH_PROVIDER", false], ["PUSH_TARGET", true], ["PUSHOVER_APP_TOKEN", true]]
    : pushProvider === "telegram" ? [["PUSH_PROVIDER", false], ["PUSH_TARGET", false], ["TELEGRAM_BOT_TOKEN", true]]
    : [["PUSH_PROVIDER", false], ["PUSH_TARGET", false]];

  const list: Omit<Connection, "status">[] = [
    {
      id: "dashboard",
      name: "Dashboard login",
      purpose: "Password-protects every page except the webhook.",
      required: true,
      steps: ["Pick a password and set DASHBOARD_PASSWORD.", "Set AUTH_SECRET to a long random string (openssl rand -hex 32)."],
      envVars: vars([["DASHBOARD_PASSWORD", true], ["AUTH_SECRET", true]]),
    },
    {
      id: "supabase",
      name: "Supabase",
      purpose: "Postgres for signals, paper trades and settings; Realtime pushes new rows to open dashboards.",
      required: true,
      signupUrl: "https://supabase.com/dashboard/sign-in",
      steps: [
        "Sign in and create a project (any region near New York, e.g. us-east-1).",
        "SQL editor → run supabase/migrations/0001_init.sql (creates the 7 tables, unique index, Realtime, seeds 16 symbols).",
        "Project Settings → API: copy the Project URL, the anon public key and the service_role key.",
      ],
      envVars: vars([["SUPABASE_URL", false], ["NEXT_PUBLIC_SUPABASE_URL", false], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", false], ["SUPABASE_SERVICE_ROLE_KEY", true]]),
    },
    {
      id: "vercel",
      name: "Vercel",
      purpose: "Hosting on HTTPS/443 (TradingView only posts to 80/443) and the 11:00 / 4:00 PM ET window-end cron.",
      required: true,
      signupUrl: "https://vercel.com/login",
      steps: [
        "Sign in and import the repo, root directory ut-bot-dashboard.",
        "Add every variable on this page under Project → Settings → Environment Variables.",
        "Set CRON_SECRET (Vercel sends it to /api/cron/window-end).",
      ],
      envVars: vars([["CRON_SECRET", true]]),
    },
    {
      id: "tradingview",
      name: "TradingView",
      purpose: "Decides every signal. Sends a JSON webhook per confirmed 2m bar and its own phone push.",
      required: true,
      signupUrl: "https://www.tradingview.com/accounts/signin/",
      steps: [
        "Paid plan (Essential or higher) — webhooks are not on the free plan.",
        "Turn on 2-factor authentication (required for webhook alerts).",
        "Pine Editor → paste ut_bot_dual_webhook.pine, add to a 2-minute chart, set the secret input = WEBHOOK_SECRET.",
        "Create alert → Any alert() function call → Notify in app + Webhook URL (shown in Settings once deployed).",
      ],
      envVars: vars([["WEBHOOK_SECRET", true]]),
    },
    {
      id: "push",
      name: `Phone push (${pushProvider})`,
      purpose: "Dashboard push after the paper engine runs. TradingView's own app push works without this.",
      required: false,
      signupUrl: pushProvider === "pushover" ? "https://pushover.net/login" : pushProvider === "telegram" ? "https://t.me/BotFather" : "https://ntfy.sh/app",
      steps:
        pushProvider === "pushover"
          ? ["Buy the Pushover app on the phone and log in at pushover.net.", "Copy your User Key → PUSH_TARGET.", "Create an Application → its API token → PUSHOVER_APP_TOKEN."]
          : pushProvider === "telegram"
            ? ["Create a bot with @BotFather → TELEGRAM_BOT_TOKEN.", "Message the bot once, then put your chat id in PUSH_TARGET."]
            : ["Install the ntfy app on the phone (no account needed).", "Subscribe to a hard-to-guess topic, e.g. utbot-7f3k9q.", "Put that topic in PUSH_TARGET."],
      envVars: vars(pushVars),
    },
    {
      id: "yahoo",
      name: "Yahoo Finance",
      purpose: "Display prices and 2m bars only (never signals). Unofficial, called server-side via yahoo-finance2.",
      required: true,
      steps: ["No account or key. Prices switch from sample to live when market data is wired up."],
      envVars: [],
    },
    {
      id: "econ",
      name: "Economic calendar",
      purpose: "News blackout: no new BUYs 10 min before → 10 min after a High-impact US event.",
      required: true,
      signupUrl: "https://www.fxstreet.com/economic-calendar",
      steps: ["Starts on the free Forex Factory weekly feed — no account.", "Later: FXStreet API once the client has an agreement (OAuth2 client id/secret)."],
      envVars: vars([["ECON_PROVIDER", false]]),
    },
    {
      id: "apify",
      name: "Apify",
      purpose: "Optional backup for the Forex Factory calendar, using the same actor the Trading Oracle app already uses (scrapemint/forexfactory-economic-calendar).",
      required: false,
      signupUrl: "https://console.apify.com/sign-in",
      steps: ["Only needed if the free Forex Factory feed gets blocked or rate-limited from Vercel.", "Console → Settings → API & Integrations → copy the API token → APIFY_API_TOKEN (can reuse the Oracle app's token)."],
      envVars: vars([["APIFY_API_TOKEN", true]]),
    },
  ];

  return list.map((c) => {
    let status: ConnStatus;
    if (c.id === "yahoo") status = "no_account_needed";
    else if (c.id === "econ") status = (process.env.ECON_PROVIDER || "forexfactory") === "fxstreet" && !has("FXSTREET_CLIENT_ID") ? "missing" : "no_account_needed";
    // TradingView counts as connected only once a real webhook has arrived, not just because a secret exists.
    else if (c.id === "tradingview") status = c.envVars.every((v) => v.set) && lastWebhookAt() ? "connected" : "missing";
    else status = c.envVars.every((v) => v.set) ? "connected" : "missing";
    return { ...c, status };
  });
}

export const isSupabaseConfigured = () => has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY");
