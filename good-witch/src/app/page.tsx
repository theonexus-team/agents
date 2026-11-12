"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Scene, type SceneName } from "@/components/Scene";
import { Wordmark, AboutConcept } from "@/components/AppShell";
import { Sheet, btn } from "@/components/ui";

const TOUR: { scene: SceneName; eyebrow: string; title: string; body: string; href: string }[] = [
  {
    scene: "candles",
    eyebrow: "Daily Magic",
    title: "A little ritual, every day",
    body: "A fresh affirmation, a reflection prompt, a letting-go exercise and a space to set your intention, saved privately on your device.",
    href: "/daily",
  },
  {
    scene: "circle",
    eyebrow: "The Good Coven",
    title: "Your people, in one place",
    body: "Daily conversations, member spotlights and announcements: a gentle community space for celebrating the journey.",
    href: "/coven",
  },
  {
    scene: "tarot",
    eyebrow: "Readings",
    title: "Find your guidance",
    body: "Explore the private 1:1 tarot reading experience and request a time that feels right.",
    href: "/readings",
  },
  {
    scene: "moon",
    eyebrow: "Events",
    title: "Gather with your coven",
    body: "Full moon circles, workshops and evenings together, virtual and in person.",
    href: "/events",
  },
  {
    scene: "stash-hat",
    eyebrow: "Shop",
    title: "Wear a little magic",
    body: "The signature Magnetic Stash Hat and hand-braided kumihimo necklaces, a tap away.",
    href: "/shop",
  },
];

export default function Welcome() {
  const [tour, setTour] = useState(false);
  const [step, setStep] = useState(0);
  const [about, setAbout] = useState(false);
  const s = TOUR[step];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-night text-ivory-50">
      <div className="absolute inset-x-0 top-0 h-[64dvh] lg:inset-0 lg:h-auto">
        <Scene name="hat" align="xMidYMax" label="A purple witch hat crowned with roses and lavender beneath a full moon" />
      </div>
      {/* legibility veil */}
      <div className="absolute inset-x-0 top-0 h-[64dvh] bg-gradient-to-t from-night via-night/20 to-night/30 lg:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-t from-night/80 via-transparent to-transparent lg:block" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-night/85 via-night/30 to-transparent lg:block" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-12">
        <div className="animate-fade flex items-center justify-between">
          <Wordmark light />
          <button
            type="button"
            onClick={() => setAbout(true)}
            className="rounded-full border border-ivory-50/25 px-3 py-1.5 text-[0.58rem] uppercase tracking-[0.2em] text-lavender-100/80 backdrop-blur hover:bg-ivory-50/10"
          >
            <span className="sm:hidden">Concept</span>
            <span className="hidden sm:inline">Concept prototype</span>
          </button>
        </div>

        <div className="mt-auto max-w-xl pt-[46dvh] pb-4 lg:mb-auto lg:pt-24">
          <p className="eyebrow animate-rise text-gold-300 [animation-delay:150ms]">Your daily magic · Your community · Your journey</p>
          <h1 className="display animate-rise mt-5 text-[2.6rem] text-ivory-50 [animation-delay:250ms] sm:text-6xl lg:text-7xl">
            A little magic for your everyday life.
          </h1>
          <div className="ornament animate-rise my-6 w-40 text-[0.5rem] [animation-delay:350ms]">◆</div>
          <p className="animate-rise max-w-md text-[1.02rem] leading-relaxed text-lavender-100/85 [animation-delay:400ms]">
            A space for daily inspiration, self-love, spiritual reflection, and connection with a community that celebrates the journey.
          </p>
          <div className="animate-rise mt-9 flex flex-col gap-3 [animation-delay:500ms] sm:flex-row">
            <Link href="/home" className={btn("gold", "lg", "w-full sm:w-auto")}>
              Enter the Coven <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setStep(0);
                setTour(true);
              }}
              className={btn("outline-light", "lg", "w-full sm:w-auto backdrop-blur-sm")}
            >
              Explore the Experience
            </button>
          </div>
          <p className="animate-fade mt-8 text-[0.68rem] leading-relaxed text-lavender-200/55 [animation-delay:800ms]">
            An independent concept inspired by the publicly visible A Good Witch brand. Not an official product or authorized collaboration.
          </p>
        </div>
      </div>

      <Sheet open={tour} onClose={() => setTour(false)} dark>
        <div key={step} className="animate-fade">
          <div className="relative -mx-6 -mt-2 h-60 overflow-hidden sm:mx-0 sm:rounded-2xl">
            <Scene name={s.scene} />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-950 to-transparent" />
          </div>
          <p className="eyebrow mt-2 text-gold-300">
            {step + 1} / {TOUR.length} · {s.eyebrow}
          </p>
          <h3 className="display mt-2 text-3xl">{s.title}</h3>
          <p className="mt-3 leading-relaxed text-lavender-100/80">{s.body}</p>
        </div>
        <div className="mt-6 flex items-center gap-1.5">
          {TOUR.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-gold-300" : "w-1.5 bg-ivory-50/25"}`}
            />
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous"
            disabled={step === 0}
            onClick={() => setStep((n) => n - 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory-50/20 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {step < TOUR.length - 1 ? (
            <button type="button" onClick={() => setStep((n) => n + 1)} className={btn("outline-light", "md", "flex-1")}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/home" className={btn("gold", "md", "flex-1")}>
              Enter the Coven <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <Link href={s.href} className="mt-4 block text-center text-xs uppercase tracking-[0.2em] text-lavender-200/70 underline-offset-4 hover:underline">
          Jump straight to {s.eyebrow}
        </Link>
      </Sheet>
      <AboutConcept open={about} onClose={() => setAbout(false)} />
    </div>
  );
}
