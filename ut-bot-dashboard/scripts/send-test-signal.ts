/**
 * Posts a sample UT Bot payload to the webhook.
 *   npm run send-test-signal                       → http://localhost:3000
 *   npm run send-test-signal -- https://app.vercel.app AAPL SELL
 */
const [base = "http://localhost:3000", ticker = "AAPL", side = "BUY"] = process.argv.slice(2);
const barClose = Math.floor(Date.now() / 120_000) * 120_000;
const body = {
  secret: process.env.WEBHOOK_SECRET ?? "",
  ticker, exchange: "NASDAQ", side, setup: side === "BUY" ? "UT1" : "UT2",
  price: 355.0, tf: "2", bar_time: barClose - 120_000, bar_close_time: barClose,
  window: "opening", ut_key: side === "BUY" ? 1 : 2, ut_atr_len: 10, ut_heikin: false,
  ut_stop: 353.42, atr: 1.58, source: "send-test-signal",
};
async function main() {
  const res = await fetch(`${base}/api/webhook/tradingview`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) });
  console.log(res.status, await res.text());
}
main();
