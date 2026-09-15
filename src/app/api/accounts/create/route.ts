import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey, generateToken } from "@/lib/auth";

/**
 * Admin-only: provisions a new client dashboard account (see the Account model
 * comment in prisma/schema.prisma for the full "why" — a separate client
 * dashboard sharing this app/domain/database, reached at /a/[accessToken] with
 * its own independent webhook). No prior account-creation code existed —
 * accounts before this were set up by hand — so this is the first reusable
 * path for the next one, not just a one-off for this request.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deskKey, name, startingBalance, maxLossFromPeak, dailyLossLimit } = body as {
    deskKey?: string;
    name?: string;
    startingBalance?: number;
    maxLossFromPeak?: number;
    dailyLossLimit?: number;
  };

  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const accessToken = generateToken();
  const webhookSecret = generateToken();
  const accountDeskKey = generateToken();

  const account = await prisma.account.create({
    data: {
      name: name.trim(),
      accessToken,
      webhookSecret,
      deskKey: accountDeskKey,
      ...(startingBalance !== undefined ? { startingBalance, peakEquity: startingBalance } : {}),
      ...(maxLossFromPeak !== undefined ? { maxLossFromPeak } : {}),
      ...(dailyLossLimit !== undefined ? { dailyLossLimit } : {}),
    },
  });

  return NextResponse.json({
    id: account.id,
    name: account.name,
    accessToken: account.accessToken,
    webhookSecret: account.webhookSecret,
    deskKey: account.deskKey,
    dashboardUrl: `https://${req.headers.get("host")}/a/${account.accessToken}`,
    startingBalance: account.startingBalance,
    maxLossFromPeak: account.maxLossFromPeak,
    dailyLossLimit: account.dailyLossLimit,
  });
}
