"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Info, Sparkles } from "lucide-react";
import { READING, READING_TIMES, money } from "@/lib/content";
import { setState, uid, useApp, useTodayKey, type ReadingRequest } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { Button, Field, btn } from "@/components/ui";

type Errors = Partial<Record<"firstName" | "email" | "date" | "time" | "focus", string>>;

function minDate(todayKey: string) {
  if (!todayKey) return undefined;
  const d = new Date(todayKey);
  d.setDate(d.getDate() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookReadingPage() {
  const app = useApp();
  const todayKey = useTodayKey();
  const [form, setForm] = useState({ firstName: "", email: "", date: "", time: "", focus: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<ReadingRequest | null>(null);
  const first = form.firstName || app.firstName;

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (!first.trim()) er.firstName = "Please add your first name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Please add a valid email.";
    const min = minDate(todayKey);
    if (!form.date) er.date = "Choose a preferred date.";
    else if (min && form.date < min) er.date = "Please choose a date at least two days from today.";
    if (!form.time) er.time = "Choose a preferred time.";
    if (form.focus.trim().length < 10) er.focus = "Share a sentence or two about what you'd like to explore.";
    setErrors(er);
    if (Object.keys(er).length) return;
    const req: ReadingRequest = { id: uid(), firstName: first.trim(), email: form.email.trim(), date: form.date, time: form.time, focus: form.focus.trim(), createdAt: Date.now() };
    setState((s) => ({ readingRequests: [req, ...s.readingRequests], firstName: s.firstName || req.firstName }));
    setDone(req);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (done) {
    return (
      <div className="px-4 pt-8 lg:px-0">
        <div className="card-dark relative mx-auto max-w-xl overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <Scene name="candles" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-plum-950/70 to-plum-950" />
          <div className="relative p-8 text-center sm:p-10">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/20 text-gold-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <p className="eyebrow mt-5 text-gold-300">Demonstration complete</p>
            <h1 className="display mt-2 text-4xl">Thank you, {done.firstName}.</h1>
            <p className="mx-auto mt-4 max-w-sm leading-relaxed text-lavender-100/80">
              This is where your reading request would be received. In this prototype, nothing has been sent, no appointment has been
              booked, and no payment was taken.
            </p>
            <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-ivory-50/10 bg-ivory-50/5 p-5 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-lavender-200/60">Reading</dt>
                <dd>Private 1:1 Tarot Reading</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-lavender-200/60">Preferred</dt>
                <dd>
                  {new Date(done.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {done.time}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-lavender-200/60">Email</dt>
                <dd className="truncate">{done.email}</dd>
              </div>
            </dl>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/profile#events" className={btn("gold", "md")}>
                View in my profile
              </Link>
              <Link href="/home" className={btn("outline-light", "md")}>
                Back home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 lg:px-0 lg:pt-8">
      <Link href="/readings" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-plum-700 hover:text-plum-900">
        <ArrowLeft className="h-4 w-4" /> Readings
      </Link>
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <aside className="card-dark relative overflow-hidden lg:self-start">
          <div className="h-48 lg:h-72">
            <Scene name="tarot" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-plum-900 via-plum-900/30 to-transparent" />
          <div className="relative -mt-16 p-6">
            <p className="eyebrow text-gold-300">Request a reading</p>
            <p className="display mt-1 text-3xl">{READING.title}</p>
            <p className="display mt-1 text-2xl text-gold-300">{money(READING.price)}</p>
            <p className="mt-3 text-sm leading-relaxed text-lavender-100/75">{READING.description}</p>
          </div>
        </aside>

        <form onSubmit={submit} noValidate className="card space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl bg-lavender-100/70 p-4 text-sm text-plum-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-plum-600" />
            <p>Booking demonstration. Submitting does not send your details, book an appointment or take payment.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name">
              <input className="field" value={first} onChange={update("firstName")} autoComplete="given-name" aria-invalid={!!errors.firstName} />
              {errors.firstName && <span className="mt-1 block text-xs text-[#a33a4f]">{errors.firstName}</span>}
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={form.email} onChange={update("email")} autoComplete="email" aria-invalid={!!errors.email} />
              {errors.email && <span className="mt-1 block text-xs text-[#a33a4f]">{errors.email}</span>}
            </Field>
            <Field label="Preferred date">
              <input className="field" type="date" min={minDate(todayKey)} value={form.date} onChange={update("date")} aria-invalid={!!errors.date} />
              {errors.date && <span className="mt-1 block text-xs text-[#a33a4f]">{errors.date}</span>}
            </Field>
            <div>
              <span className="eyebrow mb-2 block text-plum-700/80">Preferred time</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Preferred time">
                {READING_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={form.time === t}
                    onClick={() => {
                      setForm((f) => ({ ...f, time: t }));
                      setErrors((er) => ({ ...er, time: undefined }));
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                      form.time === t ? "border-plum-800 bg-plum-800 text-ivory-50" : "border-gold-500/30 bg-white text-plum-800 hover:border-plum-800/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {errors.time && <span className="mt-1 block text-xs text-[#a33a4f]">{errors.time}</span>}
            </div>
          </div>
          <Field label="What would you like to explore during your reading?">
            <textarea
              className="field min-h-36 resize-none leading-relaxed"
              value={form.focus}
              onChange={update("focus")}
              placeholder="A crossroads, a relationship, a new season, or simply a wish for clarity…"
              aria-invalid={!!errors.focus}
            />
            {errors.focus && <span className="mt-1 block text-xs text-[#a33a4f]">{errors.focus}</span>}
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Request a Reading
          </Button>
        </form>
      </div>
    </div>
  );
}
