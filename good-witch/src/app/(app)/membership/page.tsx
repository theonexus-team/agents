"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CalendarHeart, Check, Gem, MessagesSquare, PlayCircle, Sparkles } from "lucide-react";
import { MEMBERSHIP_FEATURES } from "@/lib/content";
import { setState, useApp } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useToast } from "@/components/Providers";
import { Button, btn } from "@/components/ui";

const ICONS = [PlayCircle, MessagesSquare, CalendarHeart, Gem, BellRing, Sparkles];

export default function MembershipPage() {
  const app = useApp();
  const toast = useToast();

  return (
    <div>
      <section className="relative overflow-hidden text-ivory-50 lg:mt-8 lg:rounded-[1.75rem] lg:shadow-[var(--shadow-float)]">
        <div className="absolute inset-0">
          <Scene name="hat" align="xMidYMax" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/20" />
        <div className="relative flex min-h-[34rem] flex-col justify-end px-6 pt-24 pb-10 sm:px-10">
          <span className="eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-gold-300/40 bg-night/30 px-3 py-1.5 text-gold-300 backdrop-blur">
            Proposed digital experience
          </span>
          <p className="eyebrow mt-6 text-lavender-200/80">The Good Coven</p>
          <h1 className="display mt-2 max-w-xl text-[2.6rem] leading-[1.05] sm:text-6xl">Your people. Your space. Your coven.</h1>
          <p className="mt-4 max-w-lg leading-relaxed text-lavender-100/85">
            Stay connected to the community, discover exclusive experiences, and keep up with everything happening inside A Good Witch.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/coven" className={btn("gold", "lg")}>
              Explore the Coven <ArrowRight className="h-4 w-4" />
            </Link>
            <Button
              variant="outline-light"
              size="lg"
              onClick={() => {
                setState((s) => ({ covenInterest: !s.covenInterest }));
                toast(app.covenInterest ? "Interest removed" : "Noted on this device. Thank you for your interest!");
              }}
            >
              {app.covenInterest ? (
                <>
                  <Check className="h-4 w-4" /> I&apos;m interested
                </>
              ) : (
                "I'd love this"
              )}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 px-4 lg:px-0">
        <p className="eyebrow text-gold-600">What membership could include</p>
        <h2 className="display mt-2 text-[2rem] text-plum-900">A home for everything magic.</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBERSHIP_FEATURES.map((f, i) => {
            const Icon = ICONS[i];
            return (
              <li key={f.title} className="card group p-6 transition hover:-translate-y-0.5">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-lavender-100 to-lavender-200 text-plum-700">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <p className="display mt-4 text-[1.4rem] text-plum-900">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-plum-700/75">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10 px-4 lg:px-0">
        <div className="card-dark grid overflow-hidden sm:grid-cols-2">
          <div className="h-56 sm:h-auto">
            <Scene name="circle" />
          </div>
          <div className="p-7 sm:p-9">
            <p className="eyebrow text-gold-300">Try it now</p>
            <p className="display mt-2 text-3xl leading-tight">Every part of this concept is already explorable.</p>
            <div className="mt-6 grid gap-2">
              <Link href="/daily" className="flex items-center justify-between rounded-xl border border-ivory-50/10 px-4 py-3 text-sm hover:bg-ivory-50/5">
                Daily Magic <ArrowRight className="h-4 w-4 text-gold-300" />
              </Link>
              <Link href="/coven" className="flex items-center justify-between rounded-xl border border-ivory-50/10 px-4 py-3 text-sm hover:bg-ivory-50/5">
                Community feed <ArrowRight className="h-4 w-4 text-gold-300" />
              </Link>
              <Link href="/events" className="flex items-center justify-between rounded-xl border border-ivory-50/10 px-4 py-3 text-sm hover:bg-ivory-50/5">
                Gatherings <ArrowRight className="h-4 w-4 text-gold-300" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-lg px-6 text-center text-xs leading-relaxed text-plum-700/60">
        The Good Coven membership shown here is a proposal for this concept. It is not a description of any existing paid membership, and
        no pricing is implied.
      </p>
    </div>
  );
}
