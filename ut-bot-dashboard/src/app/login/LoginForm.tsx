"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card mx-auto mt-16 max-w-sm space-y-3 px-6 py-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <input type="hidden" name="next" value={next} />
      <input name="password" type="password" autoFocus placeholder="Dashboard password" className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm" />
      {error && <div className="text-sm text-sell">{error}</div>}
      <button disabled={pending} className="w-full rounded-md bg-info/20 px-3 py-2 text-sm text-info">{pending ? "…" : "Sign in"}</button>
    </form>
  );
}
