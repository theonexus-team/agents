"use client";

import Link from "next/link";
import { ArrowRight, Check, Feather, MessageCircleHeart, Moon } from "lucide-react";
import { FEATURES, READING, money } from "@/lib/content";
import { Scene } from "@/components/Scene";
import { FeatureTile, useFeatureSheet } from "@/components/features";
import { PageHeader, SectionHeader, btn } from "@/components/ui";

const STEPS = [
  { icon: Feather, title: "Share what's on your heart", body: "Tell us a little about what you'd like to explore." },
  { icon: Moon, title: "Choose a time that feels right", body: "Suggest a preferred date and time of day." },
  { icon: MessageCircleHeart, title: "Your reading", body: "One-on-one time to reflect and gain perspective." },
];

export default function ReadingsPage() {
  const { open, sheet } = useFeatureSheet();
  const tarotGuide = FEATURES.find((f) => f.id === "f3")!;

  return (
    <div>
      <PageHeader
        eyebrow="Tarot readings"
        title="Find your guidance."
        sub="Explore the reading experiences available through A Good Witch."
      />

      <section className="mt-6 px-4 lg:px-0">
        <article className="card-dark overflow-hidden lg:grid lg:grid-cols-2">
          <div className="relative h-80 lg:h-auto lg:min-h-[32rem]">
            <Scene name="tarot" label="Three tarot cards fanned on velvet" />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-900 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-plum-900/80" />
            <span className="eyebrow absolute top-4 left-4 rounded-full bg-night/40 px-3 py-1.5 text-gold-300 backdrop-blur">Featured</span>
          </div>
          <div className="relative -mt-10 p-7 sm:p-9 lg:mt-0 lg:flex lg:flex-col lg:justify-center">
            <p className="eyebrow text-gold-300">One-on-one</p>
            <h2 className="display mt-2 text-[2.3rem] leading-tight sm:text-5xl">Private 1:1 Tarot Reading</h2>
            <p className="display mt-3 text-4xl text-gold-300">{money(READING.price)}</p>
            <p className="mt-4 max-w-md leading-relaxed text-lavender-100/80">{READING.description}</p>
            <ul className="mt-5 space-y-2.5">
              {READING.includes.map((i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-lavender-100/85">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-300">
                    <Check className="h-3 w-3" />
                  </span>
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/readings/book" className={btn("gold", "lg", "mt-8 w-full sm:w-auto")}>
              Explore Private Readings <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-[0.68rem] leading-relaxed text-lavender-200/55">
              Offer and price reflect the publicly visible reading. Booking in this prototype is a demonstration only.
            </p>
          </div>
        </article>
      </section>

      <section className="mt-12 px-5 lg:px-0">
        <SectionHeader eyebrow="The experience" title="How a reading could work" />
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-lavender-100 text-plum-700">
                  <s.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <span className="display text-3xl text-gold-500/60">0{i + 1}</span>
              </div>
              <p className="display mt-4 text-xl text-plum-900">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-plum-700/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 px-5 lg:px-0">
        <SectionHeader eyebrow="Before your reading" title="Begin your own practice" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureTile feature={tarotGuide} onOpen={() => open(tarotGuide.id)} />
          <div className="card flex flex-col justify-center p-7">
            <p className="font-serif text-2xl leading-snug text-plum-900 italic">
              “A reading isn&apos;t about being told what will happen. It&apos;s about making space to hear yourself.”
            </p>
            <p className="eyebrow mt-4 text-gold-600">Sample message written for this concept</p>
            <Link href="/daily#reflection" className={btn("outline", "md", "mt-6 self-start")}>
              Journal a question
            </Link>
          </div>
        </div>
      </section>
      {sheet}
    </div>
  );
}
