/** Single-password login. Cookie holds an HMAC of the password so changing it logs everyone out. */
export const AUTH_COOKIE = "utbot_auth";

export async function expectedToken(): Promise<string | null> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return null;
  const secret = process.env.AUTH_SECRET || "dev-only-auth-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`utbot:${pw}`));
  return Buffer.from(sig).toString("hex");
}
