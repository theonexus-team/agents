/**
 * Tradovate REST client — read-only (accounts, cash balances, positions).
 * Auth: https://api.tradovate.com/#section/Getting-Started/Authorization
 */

type AccessToken = {
  token: string;
  mdToken: string;
  expiresAt: number;
};

let cachedToken: AccessToken | null = null;

function baseUrl(): string {
  return process.env.TRADOVATE_ENV === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}

export function tradovateConfigured(): boolean {
  return Boolean(
    process.env.TRADOVATE_CID &&
      process.env.TRADOVATE_SEC &&
      process.env.TRADOVATE_USERNAME &&
      process.env.TRADOVATE_PASSWORD
  );
}

async function authenticate(): Promise<AccessToken> {
  const res = await fetch(`${baseUrl()}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: process.env.TRADOVATE_USERNAME,
      password: process.env.TRADOVATE_PASSWORD,
      appId: process.env.TRADOVATE_APP_ID ?? "KOLDesk",
      appVersion: process.env.TRADOVATE_APP_VERSION ?? "1.0",
      cid: Number(process.env.TRADOVATE_CID),
      sec: process.env.TRADOVATE_SEC,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.errorText || !data.accessToken) {
    throw new Error(data.errorText ?? `Tradovate auth failed (${res.status})`);
  }

  return {
    token: data.accessToken,
    mdToken: data.mdAccessToken,
    // Tradovate tokens are typically valid ~80 minutes; refresh a bit early.
    expiresAt: Date.now() + 70 * 60 * 1000,
  };
}

async function getToken(): Promise<AccessToken> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken;
  cachedToken = await authenticate();
  return cachedToken;
}

async function authedGet<T>(path: string): Promise<T> {
  const { token } = await getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Tradovate GET ${path} failed (${res.status})`);
  }
  return res.json();
}

export type TradovateAccount = {
  id: number;
  name: string;
  accountType: string;
  active: boolean;
};

export type TradovateCashBalance = {
  accountId: number;
  amount: number;
};

export type TradovatePosition = {
  id: number;
  accountId: number;
  contractId: number;
  netPos: number;
  netPrice: number | null;
};

export type TradovateContract = {
  id: number;
  name: string;
};

export async function listAccounts(): Promise<TradovateAccount[]> {
  return authedGet<TradovateAccount[]>("/account/list");
}

export async function listCashBalances(): Promise<TradovateCashBalance[]> {
  return authedGet<TradovateCashBalance[]>("/cashBalance/list");
}

export async function listPositions(): Promise<TradovatePosition[]> {
  return authedGet<TradovatePosition[]>("/position/list");
}

export async function listContracts(): Promise<TradovateContract[]> {
  return authedGet<TradovateContract[]>("/contract/list");
}

export type AccountSummary = {
  id: number;
  name: string;
  accountType: string;
  active: boolean;
  cashBalance: number;
  openPositions: { contractName: string; netPos: number; netPrice: number | null }[];
};

export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const [accounts, balances, positions, contracts] = await Promise.all([
    listAccounts(),
    listCashBalances(),
    listPositions(),
    listContracts(),
  ]);

  const contractName = new Map(contracts.map((c) => [c.id, c.name]));
  const balanceByAccount = new Map(balances.map((b) => [b.accountId, b.amount]));
  const positionsByAccount = new Map<number, TradovatePosition[]>();
  for (const p of positions) {
    if (p.netPos === 0) continue;
    const list = positionsByAccount.get(p.accountId) ?? [];
    list.push(p);
    positionsByAccount.set(p.accountId, list);
  }

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    active: a.active,
    cashBalance: balanceByAccount.get(a.id) ?? 0,
    openPositions: (positionsByAccount.get(a.id) ?? []).map((p) => ({
      contractName: contractName.get(p.contractId) ?? `#${p.contractId}`,
      netPos: p.netPos,
      netPrice: p.netPrice,
    })),
  }));
}
