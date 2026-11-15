"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get("password") ?? "");
  if (!process.env.DASHBOARD_PASSWORD || pw !== process.env.DASHBOARD_PASSWORD) return "Wrong password";
  (await cookies()).set(AUTH_COOKIE, (await expectedToken())!, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const next = String(form.get("next") || "/");
  redirect(next.startsWith("/") ? next : "/");
}
