import { signIn } from "@/lib/authjs";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <div className="mb-1.5 text-[17px] font-semibold tracking-[0.18em] uppercase text-foreground">
          Theonexus
        </div>
        <div className="text-[11px] tracking-[0.14em] uppercase text-brand-2">Trading Oracle</div>
      </div>
      <p className="m-0 text-sm text-muted">Sign in with the Google account tied to your mastermind membership.</p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="btn btn-primary">
          Continue with Google
        </button>
      </form>
    </main>
  );
}
