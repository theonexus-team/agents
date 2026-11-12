"use client";

import { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Feather, Flame, Heart, RefreshCw, Share2, Sun, Trash2, Wind } from "lucide-react";
import { AFFIRMATIONS, INTENTION_ENERGIES, REFLECTION_PROMPTS, RELEASE_CATEGORIES } from "@/lib/content";
import { addJournal, setHash, setState, toggleIn, useApp, useHash, useHydrated } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useDaily } from "@/components/features";
import { useToast } from "@/components/Providers";
import { Button, Empty, Field, IconButton, PageHeader, timeAgo, useShare } from "@/components/ui";

const TABS = [
  { id: "affirmation", label: "Affirmation", icon: Sun },
  { id: "reflection", label: "Reflection", icon: Feather },
  { id: "release", label: "Letting Go", icon: Wind },
  { id: "intention", label: "Intention", icon: Flame },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function DailyPage() {
  const hash = useHash();
  const tab: Tab = TABS.some((t) => t.id === hash) ? (hash as Tab) : "affirmation";
  const choose = (t: Tab) => setHash(t);

  return (
    <div>
      <PageHeader eyebrow="A ritual for every day" title="Your Daily Magic" sub="Four small practices to help you pause, reflect and choose how you want to feel. Come back each day for something new." />

      <div className="sticky top-[5.6rem] z-20 mt-5 bg-ivory-100/90 px-4 py-2 backdrop-blur-md lg:top-[3.9rem] lg:px-0">
        <div role="tablist" aria-label="Daily practices" className="grid grid-cols-4 gap-1 rounded-full border border-gold-500/20 bg-ivory-50 p-1 shadow-[var(--shadow-card)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => choose(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[0.62rem] tracking-[0.06em] transition-all sm:flex-row sm:justify-center sm:gap-2 sm:text-xs ${
                tab === t.id ? "bg-plum-800 text-ivory-50 shadow" : "text-plum-700 hover:bg-plum-800/5"
              }`}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-rise mt-5 px-4 lg:px-0">
        {tab === "affirmation" && <AffirmationPanel />}
        {tab === "reflection" && <ReflectionPanel />}
        {tab === "release" && <ReleasePanel />}
        {tab === "intention" && <IntentionPanel />}
      </div>

      <p className="mx-auto mt-10 max-w-md px-6 text-center text-[0.7rem] leading-relaxed text-plum-700/55">
        These practices are for inspiration and personal reflection. They are not medical or mental health treatment. If you are
        struggling, please reach out to a qualified professional.
      </p>
    </div>
  );
}

/* ---------------- A. Affirmation ---------------- */

function AffirmationPanel() {
  const daily = useDaily();
  const app = useApp();
  const share = useShare();
  const toast = useToast();
  // offset 0 = today, 1 = yesterday...
  const [offset, setOffset] = useState(0);
  const idx = (((daily.index - offset) % AFFIRMATIONS.length) + AFFIRMATIONS.length) % AFFIRMATIONS.length;
  const a = AFFIRMATIONS[idx];
  const saved = app.savedAffirmations.includes(a.id);
  const fav = app.favoriteAffirmations.includes(a.id);

  const dayLabel = (o: number) => {
    if (o === 0) return "Today";
    if (o === 1) return "Yesterday";
    const d = new Date(daily.date);
    d.setDate(d.getDate() - o);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <article className="card-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-70">
          <Scene name={(["moon", "candles", "hat", "tarot"] as const)[idx % 4]} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-plum-950/70 via-plum-950/60 to-plum-950/95" />
        <div className="relative flex min-h-[26rem] flex-col p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-gold-300">{dayLabel(offset)}</p>
            <p className="eyebrow text-lavender-200/70">{a.theme}</p>
          </div>
          <div className="my-auto py-10 text-center">
            <div className="ornament mx-auto mb-6 w-24 text-[0.45rem]">◆</div>
            <blockquote key={a.id} className="display animate-fade text-[2.1rem] leading-[1.15] text-ivory-50 sm:text-[2.6rem]">
              {a.text}
            </blockquote>
            <div className="ornament mx-auto mt-6 w-24 text-[0.45rem]">◆</div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <IconButton tone="dark" label="Earlier affirmation" onClick={() => setOffset((o) => Math.min(o + 1, AFFIRMATIONS.length - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <div className="flex gap-2">
              <IconButton
                tone="dark"
                label={saved ? "Unsave affirmation" : "Save affirmation"}
                active={saved}
                onClick={() => {
                  setState((s) => ({ savedAffirmations: toggleIn(s.savedAffirmations, a.id) }));
                  toast(saved ? "Removed from saved" : "Affirmation saved");
                }}
              >
                <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
              </IconButton>
              <IconButton
                tone="dark"
                label={fav ? "Remove favourite" : "Mark as favourite"}
                active={fav}
                onClick={() => {
                  setState((s) => ({ favoriteAffirmations: toggleIn(s.favoriteAffirmations, a.id) }));
                  toast(fav ? "Removed from favourites" : "Marked as a favourite");
                }}
              >
                <Heart className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
              </IconButton>
              <IconButton tone="dark" label="Share affirmation" onClick={() => share(`“${a.text}”`, "An affirmation")}>
                <Share2 className="h-4 w-4" />
              </IconButton>
            </div>
            <IconButton tone="dark" label="Later affirmation" onClick={() => setOffset((o) => Math.max(o - 1, 0))}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </article>

      <div>
        <h3 className="display mb-3 text-2xl text-plum-900">Previous affirmations</h3>
        <ul className="space-y-2">
          {Array.from({ length: AFFIRMATIONS.length }, (_, o) => {
            const i = (((daily.index - o) % AFFIRMATIONS.length) + AFFIRMATIONS.length) % AFFIRMATIONS.length;
            const item = AFFIRMATIONS[i];
            const isFav = app.favoriteAffirmations.includes(item.id);
            const isSaved = app.savedAffirmations.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOffset(o);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                    o === offset ? "border-plum-700/40 bg-lavender-100" : "border-gold-500/15 bg-ivory-50 hover:border-gold-500/40"
                  }`}
                >
                  <span className="eyebrow mt-1 w-20 shrink-0 text-gold-600">{o === 0 ? "Today" : o === 1 ? "Yesterday" : `${o} days ago`}</span>
                  <span className="flex-1 font-serif text-[1.08rem] leading-snug text-plum-900">{item.text}</span>
                  <span className="mt-1 flex gap-1 text-plum-600">
                    {isSaved && <Bookmark className="h-3.5 w-3.5" fill="currentColor" />}
                    {isFav && <Heart className="h-3.5 w-3.5" fill="currentColor" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Journal list (shared) ---------------- */

function JournalList({ kind, empty }: { kind: "reflection" | "release" | "intention"; empty: string }) {
  const app = useApp();
  const hydrated = useHydrated();
  const entries = app.journal.filter((e) => e.kind === kind);
  if (!hydrated) return null;
  if (!entries.length) return <Empty title="Nothing here yet" body={empty} />;
  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="card group p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-gold-600">
              {e.tag ? `${e.tag} · ` : ""}
              {timeAgo(e.createdAt)}
            </p>
            <button
              type="button"
              aria-label="Delete entry"
              onClick={() => setState((s) => ({ journal: s.journal.filter((x) => x.id !== e.id) }))}
              className="rounded-full p-1.5 text-plum-700/40 transition hover:bg-plum-800/5 hover:text-plum-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 font-serif text-[0.98rem] text-plum-700/70 italic">{e.prompt}</p>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap text-plum-900">{e.text}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- B. Reflection ---------------- */

function ReflectionPanel() {
  const daily = useDaily();
  const toast = useToast();
  const [shift, setShift] = useState(0);
  const [text, setText] = useState("");
  const prompt = REFLECTION_PROMPTS[(daily.index + shift) % REFLECTION_PROMPTS.length];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="card overflow-hidden">
        <div className="relative h-40">
          <Scene name="botanical" />
          <div className="absolute inset-0 bg-gradient-to-t from-ivory-50 to-transparent" />
        </div>
        <div className="relative -mt-8 px-6 pb-6 sm:px-8">
          <p className="eyebrow text-gold-600">{shift === 0 ? "Today's reflection" : "Another prompt"}</p>
          <h2 key={prompt.id} className="display animate-fade mt-2 text-[1.9rem] leading-tight text-plum-900">
            {prompt.text}
          </h2>
          <button
            type="button"
            onClick={() => setShift((n) => (n + 1) % REFLECTION_PROMPTS.length)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-plum-600 hover:text-plum-900"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try a different prompt
          </button>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              addJournal({ kind: "reflection", prompt: prompt.text, text: text.trim() });
              setText("");
              toast("Reflection saved to your private journal");
            }}
          >
            <Field label="Your private response" hint="Stays in this browser only. Never posted anywhere.">
              <textarea className="field min-h-44 resize-none leading-relaxed" placeholder="Take your time…" value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full sm:w-auto" disabled={!text.trim()}>
              Save reflection
            </Button>
          </form>
        </div>
      </section>
      <section>
        <h3 className="display mb-3 text-2xl text-plum-900">Your reflection journal</h3>
        <JournalList kind="reflection" empty="Your saved reflections will appear here, private to you." />
      </section>
    </div>
  );
}

/* ---------------- C. Letting go ---------------- */

function ReleasePanel() {
  const toast = useToast();
  const [cat, setCat] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);

  const label = cat === "Something else" ? other.trim() || "Something else" : cat;

  const release = () => {
    if (!cat || !text.trim()) return;
    if (keep) addJournal({ kind: "release", prompt: "What are you ready to release?", text: text.trim(), tag: label ?? undefined });
    setReleasing(text.trim());
    setText("");
    window.setTimeout(() => {
      setReleasing(null);
      setCat(null);
      setOther("");
      toast(keep ? "Released, and kept privately in your journal" : "Released. Nothing was saved");
    }, 2400);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="card-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-50">
          <Scene name="moon" align="xMidYMax" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-plum-950/80 to-plum-950/95" />
        <div className="relative p-6 sm:p-8">
          <p className="eyebrow text-gold-300">A letting-go ritual</p>
          <h2 className="display mt-2 text-[2rem] leading-tight">What are you ready to release?</h2>
          {releasing ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
              <p className="animate-release max-w-sm font-serif text-2xl text-lavender-100 italic">{releasing}</p>
              <p className="animate-fade mt-8 text-sm text-gold-300 [animation-delay:1.4s]">Breathe out. Let it drift away.</p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-lavender-100/75">Choose what feels heavy today. Name it, write it, then let it go.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {RELEASE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cat === c}
                    onClick={() => setCat(c)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      cat === c ? "border-gold-300 bg-gold-300 text-plum-950" : "border-ivory-50/20 text-lavender-100 hover:border-ivory-50/50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {cat === "Something else" && (
                <input className="field field-dark mt-3" placeholder="Name it in a word or two" value={other} onChange={(e) => setOther(e.target.value)} />
              )}
              {cat && (
                <div className="animate-rise mt-5 space-y-4">
                  <textarea
                    className="field field-dark min-h-36 resize-none leading-relaxed"
                    placeholder={`Write what ${label?.toLowerCase()} has been asking of you, and what you would like instead…`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-lavender-100/80">
                    <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-[#cfb173]" />
                    Keep a private copy in my journal
                  </label>
                  <Button variant="gold" className="w-full" disabled={!text.trim()} onClick={release}>
                    <Wind className="h-4 w-4" /> Release it
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <section>
        <h3 className="display mb-3 text-2xl text-plum-900">What you&apos;ve released</h3>
        <JournalList kind="release" empty="Anything you choose to keep after a release is stored here, privately." />
      </section>
    </div>
  );
}

/* ---------------- D. Intention ---------------- */

function IntentionPanel() {
  const app = useApp();
  const toast = useToast();
  const daily = useDaily();
  const [energy, setEnergy] = useState<string>("Calm");
  const [text, setText] = useState("");
  const todays = app.journal.find((e) => e.kind === "intention" && new Date(e.createdAt).toDateString() === daily.key);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="card overflow-hidden">
        <div className="relative h-44">
          <Scene name="candles" />
          <div className="absolute inset-0 bg-gradient-to-t from-ivory-50 via-transparent to-transparent" />
        </div>
        <div className="relative -mt-6 px-6 pb-7 sm:px-8">
          <p className="eyebrow text-gold-600">Set your intention</p>
          <h2 className="display mt-2 text-[2rem] leading-tight text-plum-900">What energy are you bringing into today?</h2>

          {todays && (
            <div className="animate-rise mt-5 rounded-2xl border border-gold-400/40 bg-gradient-to-br from-lavender-100 to-ivory-50 p-5">
              <p className="eyebrow text-gold-600">Today&apos;s intention · {todays.tag}</p>
              <p className="display mt-2 text-2xl text-plum-900">“{todays.text}”</p>
            </div>
          )}

          <div className="mt-6">
            <p className="eyebrow mb-2.5 text-plum-700/80">Choose an energy</p>
            <div className="flex flex-wrap gap-2">
              {INTENTION_ENERGIES.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={energy === e}
                  onClick={() => setEnergy(e)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    energy === e ? "border-plum-800 bg-plum-800 text-ivory-50" : "border-plum-800/15 text-plum-800 hover:border-plum-800/40"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              addJournal({ kind: "intention", prompt: "What energy are you bringing into today?", text: text.trim(), tag: energy });
              setText("");
              toast(`Intention set: ${energy}`);
            }}
          >
            <Field label="My intention">
              <input className="field" placeholder={`Today I choose ${energy.toLowerCase()} by…`} value={text} onChange={(e) => setText(e.target.value)} maxLength={160} />
            </Field>
            <Button type="submit" className="w-full sm:w-auto" disabled={!text.trim()}>
              {todays ? "Set a new intention" : "Set my intention"}
            </Button>
          </form>
        </div>
      </section>
      <section>
        <h3 className="display mb-3 text-2xl text-plum-900">Past intentions</h3>
        <JournalList kind="intention" empty="Each intention you set is kept here so you can look back on your energy over time." />
      </section>
    </div>
  );
}
