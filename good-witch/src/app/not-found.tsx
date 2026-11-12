import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-plum-950 px-6 text-center text-ivory-50">
      <p className="eyebrow text-gold-300">Lost in the mist</p>
      <h1 className="display mt-3 text-5xl">This path isn&apos;t written yet.</h1>
      <Link href="/home" className="mt-8 rounded-full bg-gold-400 px-7 py-3 text-xs uppercase tracking-[0.2em] text-plum-950">
        Return home
      </Link>
    </div>
  );
}
