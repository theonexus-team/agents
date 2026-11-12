"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, CalendarHeart, Feather, Moon, Share2, Sparkles, Store, Users } from "lucide-react";
import { BRAND, FEATURES } from "@/lib/content";
import { useApp } from "@/lib/store";
import { Scene, type SceneName } from "@/components/Scene";
import { FeatureTile, MoonBadge, ReflectSheet, SaveMessageButton, useDaily, useFeatureSheet } from "@/components/features";
import { Button, DemoTag, SectionHeader, useShare } from "@/components/ui";

const EXPLORE: { href: string; title: string; body: string; scene: SceneName; icon: typeof Sparkles }[] = [
  { href: "/daily", title: "Daily Magic", body: "Affirmations, reflection & intention", scene: "candles", icon: Sparkles },
  { href: "/coven", title: "The Good Coven", body: "Share, connect & celebrate", scene: "circle", icon: Users },
  { href: "/readings", title: "Tarot Readings", body: "Private 1:1 guidance", scene: "tarot", icon: Moon },
  { href: "/events", title: "Upcoming Events", body: "Circles & gatherings", scene: "moon", icon: CalendarHeart },
  { href: "/shop", title: "Shop the Collection", body: "Hats & kumihimo necklaces", scene: "stash-hat", icon: Store },
];

export default function HomePage() {
  const daily = useDaily();
  const app = useApp();
  const share = useShare();
  const [reflect, setReflect] = useState(false);
  const { open, sheet } = useFeatureSheet();
  const featured = FEATURES[daily.index % FEATURES.length];
  const streak = app.visits.length;

  return (
    <div>
      {/* Greeting */}
      <section className="px-5 pt-7 lg:px-0 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-gold-600">{BRAND.name}</p>
            <h1 className="display mt-2 text-[2.35rem] text-plum-900 sm:text-5xl">Welcome back, witch.</h1>
            <p className="mt-2 text-plum-700/75">
              {app.firstName ? `${app.firstName}, your` : "Your"} daily dose of magic is waiting.
            </p>
          </div>
          <div className="hidden sm:block">
            <MoonBadge />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 sm:hidden">
          <MoonBadge />
        </div>
      </section>

      {/* Today's magic */}
      <section className="mt-7 px-4 lg:px-0" aria-labelledby="today">
        <article className="card-dark overflow-hidden lg:grid lg:grid-cols-[1fr_1.1fr]">
          <div className="relative h-72 sm:h-80 lg:h-auto lg:min-h-[30rem]">
            <Scene name={daily.scene} label="Today's magic artwork" />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-900 via-plum-900/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-plum-900" />
            <div className="absolute top-4 left-4">
              <span className="eyebrow rounded-full bg-night/40 px-3 py-1.5 text-gold-300 backdrop-blur" id="today">
                Today&apos;s Magic
              </span>
            </div>
          </div>
          <div className="relative -mt-16 px-6 pb-7 lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-10">
            <p className="eyebrow text-gold-300">Affirmation · {daily.affirmation.theme}</p>
            <blockquote className="display mt-3 text-[2rem] leading-[1.12] text-ivory-50 sm:text-[2.4rem]">
              “{daily.affirmation.text}”
            </blockquote>
            <div className="ornament my-6 text-[0.45rem]">◆</div>
            <div className="space-y-4">
              <div>
                <p className="eyebrow mb-1.5 text-lavender-300">Reflection prompt</p>
                <p className="font-serif text-xl leading-snug text-lavender-100 italic">{daily.prompt.text}</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5 text-lavender-300">A note for today</p>
                <p className="text-[0.95rem] leading-relaxed text-lavender-100/80">{daily.message}</p>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <SaveMessageButton dayKey={daily.key} tone="dark" />
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => share(`“${daily.affirmation.text}”\n\n${daily.message}`, "Today's magic")}
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              <Button variant="outline-light" size="sm" onClick={() => setReflect(true)}>
                <Feather className="h-3.5 w-3.5" /> Reflect
              </Button>
            </div>
            <p className="mt-5 text-[0.65rem] text-lavender-200/50">Sample daily content written for this concept.</p>
          </div>
        </article>
      </section>

      {/* Journey strip */}
      <section className="mt-5 px-4 lg:px-0">
        <div className="card flex items-center gap-4 px-5 py-4">
          <div className="flex -space-x-1">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ring-2 ring-ivory-50 ${i < Math.min(streak, 7) ? "bg-gold-400" : "bg-lavender-200"}`}
              />
            ))}
          </div>
          <p className="flex-1 text-sm text-plum-800">
            <span className="font-medium">{streak} {streak === 1 ? "day" : "days"}</span> of magic ·{" "}
            <span className="text-plum-700/70">{app.journal.length} journal {app.journal.length === 1 ? "entry" : "entries"}</span>
          </p>
          <Link href="/profile" className="text-xs uppercase tracking-[0.16em] text-gold-600 hover:text-plum-800">
            My space
          </Link>
        </div>
      </section>

      {/* Explore */}
      <section className="mt-11 px-5 lg:px-0">
        <SectionHeader eyebrow="Everything in one place" title="Explore your coven" />
        <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {EXPLORE.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative block w-40 shrink-0 snap-start overflow-hidden rounded-2xl shadow-[var(--shadow-card)] lg:w-auto"
            >
              <div className="aspect-[3/4]">
                <Scene name={c.scene} className="transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
              <span className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ivory-50/15 text-ivory-50 backdrop-blur transition group-hover:bg-ivory-50 group-hover:text-plum-900">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3.5 text-ivory-50">
                <c.icon className="mb-2 h-4 w-4 text-gold-300" strokeWidth={1.5} />
                <p className="display text-[1.2rem] leading-tight">{c.title}</p>
                <p className="mt-1 text-[0.7rem] text-lavender-100/75">{c.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* From Shelley */}
      <section className="mt-11 px-5 lg:px-0">
        <SectionHeader eyebrow="Exclusive inside the app" title={`From ${BRAND.creator}`} action={<DemoTag>Demonstration</DemoTag>} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <button
            type="button"
            onClick={() => open(featured.id)}
            className="group card-dark relative block overflow-hidden text-left"
          >
            <div className="aspect-[4/3] sm:aspect-[16/9]">
              <Scene name={featured.scene} className="transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/5" />
            <span className="absolute top-1/2 left-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ivory-50/40 bg-ivory-50/15 backdrop-blur transition group-hover:scale-110 group-hover:bg-ivory-50/25">
              <span className="ml-1 h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-ivory-50" />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="eyebrow text-gold-300">
                Today&apos;s video · {featured.duration}
              </p>
              <p className="display mt-1.5 text-[1.7rem] leading-tight text-ivory-50">{featured.title}</p>
              <p className="mt-1 text-sm text-lavender-100/70">{featured.blurb}</p>
            </div>
          </button>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 lg:mx-0 lg:grid lg:grid-cols-1 lg:gap-3 lg:overflow-visible lg:px-0">
            {FEATURES.filter((f) => f.id !== featured.id).map((f) => (
              <div key={f.id} className="lg:hidden">
                <FeatureTile feature={f} onOpen={() => open(f.id)} compact />
              </div>
            ))}
            {FEATURES.filter((f) => f.id !== featured.id).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => open(f.id)}
                className="card group hidden items-center gap-4 p-3 text-left transition hover:-translate-y-0.5 lg:flex"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                  <Scene name={f.scene} />
                </div>
                <div className="min-w-0">
                  <p className="eyebrow text-gold-600">
                    {f.kind} · {f.duration}
                  </p>
                  <p className="display mt-1 text-lg leading-tight text-plum-900">{f.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Membership teaser */}
      <section className="mt-11 px-4 lg:px-0">
        <Link href="/membership" className="card-dark group relative block overflow-hidden p-7 sm:p-9">
          <div className="absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]">
            <Scene name="circle" />
          </div>
          <div className="relative max-w-sm">
            <p className="eyebrow text-gold-300">Proposed experience</p>
            <p className="display mt-2 text-3xl leading-tight">Your people. Your space. Your coven.</p>
            <p className="mt-3 text-sm leading-relaxed text-lavender-100/75">See how The Good Coven membership could come to life.</p>
            <span className="eyebrow mt-6 inline-flex items-center gap-2 text-gold-300 group-hover:gap-3 transition-all">
              Explore the Coven <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      </section>

      <ReflectSheet open={reflect} onClose={() => setReflect(false)} prompt={daily.prompt.text} />
      {sheet}
    </div>
  );
}
