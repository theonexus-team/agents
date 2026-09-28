import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("account");
  const account = token ? await prisma.account.findUnique({ where: { accessToken: token } }) : null;
  if (!account) {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  }

  return NextResponse.json({
    name: account.name,
    dashboardUrl: `${req.nextUrl.origin}/a/${account.accessToken}`,
    webhookSecret: account.webhookSecret,
    webhookUrl: `${req.nextUrl.origin}/api/webhook/tradingview`,
    installRequestedAt: account.installRequestedAt,
    installPaidAt: account.installPaidAt,
  });
}
