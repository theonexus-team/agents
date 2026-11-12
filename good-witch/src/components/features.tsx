"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, Pause, Play } from "lucide-react";
import { BRAND, FEATURES, type Feature, dayIndex, moonPhase, todaysMagic } from "@/lib/content";
import { addJournal, setState, toggleIn, useApp, useTodayKey } from "@/lib/store";
import { useToast } from "./Providers";
import { Scene } from "./Scene";
import { Button, DemoTag, Field, Sheet } from "./ui";

/** Today's rotating content. Computed on the client so it follows the visitor's date. */
export function useDaily() {
  const key = useTodayKey();
  return useMemo(() => {
    const date = key ? new Date(key) : new Date(2026, 0, 1);
    return { key: key || "today", date, index: dayIndex(date), ...todaysMagic(date), moon: moonPhase(date) };
  }, [key]);
}

/* ---------------- Reflect sheet ---------------- */

export function ReflectSheet({
  open,
  onClose,
  prompt,
  kind = "reflection",
  tag,
}: {
  open: boolean;
  onClose: () => void;
  prompt: string;
  kind?: "reflection" | "release" | "intention";
  tag?: string;
}) {
  const [text, setText] = useState("");
  const toast = useToast();
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Private reflection" title="Take a quiet moment">
      <p className="display text-[1.45rem] leading-snug text-plum-800 italic">“{prompt}”</p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addJournal({ kind, prompt, text: text.trim(), tag });
          setText("");
          onClose();
          toast("Saved to your private journal");
        }}
      >
        <Field label="Your words" hint="Saved only in this browser. Nobody else can see it.">
          <textarea
            className="field min-h-40 resize-none leading-relaxed"
            placeholder="Write whatever comes to you…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={!text.trim()}>
          Save to my journal
        </Button>
      </form>
    </Sheet>
  );
}

/* ---------------- Creator content player (simulated) ---------------- */

export function ContentSheet({ feature, onClose }: { feature: Feature | null; onClose: () => void }) {
  const app = useApp();
  const toast = useToast();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setPlaying(false);
          return 100;
        }
        return p + 1.25;
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [playing]);

  if (!feature) return null;
  const fav = app.favoriteContent.includes(feature.id);
  const line = Math.min(feature.transcript.length - 1, Math.floor((progress / 100) * feature.transcript.length));

  const close = () => {
    setPlaying(false);
    setProgress(0);
    onClose();
  };

  return (
    <Sheet open onClose={close} dark eyebrow={`From ${BRAND.creator} · ${feature.kind}`} title={feature.title}>
      <div className="relative -mx-6 aspect-[4/5] overflow-hidden sm:mx-0 sm:aspect-video sm:rounded-2xl">
        <Scene name={feature.scene} />
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
        <div className="absolute top-3 left-3">
          <DemoTag tone="dark">Sample message for this concept</DemoTag>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          {progress > 0 && (
            <p key={line} className="display animate-fade mb-4 text-xl leading-snug text-ivory-50 italic">
              “{feature.transcript[line]}”
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => {
                if (progress >= 100) setProgress(0);
                setPlaying((p) => !p);
              }}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ivory-50 text-plum-900 shadow-lg transition active:scale-90"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ivory-50/20">
              <div className="h-full rounded-full bg-gold-300 transition-[width] duration-100" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-lavender-100/70 tabular-nums">{feature.duration}</span>
          </div>
        </div>
      </div>
      <p className="mt-5 leading-relaxed text-lavender-100/80">{feature.blurb}</p>
      <p className="mt-3 text-xs leading-relaxed text-lavender-200/50">
        Demonstration of how {BRAND.creator} could publish exclusive videos and daily messages inside the app. The text above is written
        for this prototype; no real video is shown.
      </p>
      <div className="mt-5 flex gap-3">
        <Button
          variant={fav ? "gold" : "outline-light"}
          className="flex-1"
          onClick={() => {
            setState((s) => ({ favoriteContent: toggleIn(s.favoriteContent, feature.id) }));
            toast(fav ? "Removed from favourites" : "Added to your favourites");
          }}
        >
          <Heart className="h-4 w-4" fill={fav ? "currentColor" : "none"} /> {fav ? "Favourited" : "Favourite"}
        </Button>
      </div>
    </Sheet>
  );
}

export function FeatureTile({ feature, onOpen, compact }: { feature: Feature; onOpen: () => void; compact?: boolean }) {
  const app = useApp();
  const fav = app.favoriteContent.includes(feature.id);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative block shrink-0 overflow-hidden rounded-2xl text-left shadow-[var(--shadow-card)] ${compact ? "w-56" : "w-full"}`}
    >
      <div className={compact ? "aspect-[4/5]" : "aspect-[4/3]"}>
        <Scene name={feature.scene} className="transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-night/95 via-night/40 to-transparent" />
      <span className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ivory-50/90 text-plum-900">
        <Play className="ml-0.5 h-4 w-4" />
      </span>
      {fav && (
        <span className="absolute top-3 left-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold-400 text-plum-950">
          <Heart className="h-3.5 w-3.5" fill="currentColor" />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-4 text-ivory-50">
        <p className="eyebrow text-gold-300">
          {feature.kind} · {feature.duration}
        </p>
        <p className="display mt-1 text-xl leading-tight">{feature.title}</p>
      </div>
    </button>
  );
}

export function useFeatureSheet() {
  const [id, setId] = useState<string | null>(null);
  const feature = FEATURES.find((f) => f.id === id) ?? null;
  return { open: setId, sheet: <ContentSheet feature={feature} onClose={() => setId(null)} /> };
}

export function SaveMessageButton({ dayKey, tone = "light" }: { dayKey: string; tone?: "light" | "dark" }) {
  const app = useApp();
  const toast = useToast();
  const saved = app.savedMessages.includes(dayKey);
  return (
    <Button
      variant={saved ? "gold" : tone === "dark" ? "light" : "primary"}
      size="sm"
      onClick={() => {
        setState((s) => ({ savedMessages: toggleIn(s.savedMessages, dayKey) }));
        toast(saved ? "Removed from your saved messages" : "Saved to your profile");
      }}
    >
      <Bookmark className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "Save this message"}
    </Button>
  );
}

export function MoonBadge() {
  const { moon } = useDaily();
  const lit = Math.round(moon.illumination * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-block h-9 w-9 overflow-hidden rounded-full bg-plum-800 shadow-[inset_0_0_0_1px_rgb(226_203_148/0.5),0_0_14px_rgb(169_139_189/0.5)]">
        <span
          className="absolute inset-y-0 bg-ivory-100"
          style={{
            width: `${lit}%`,
            ...(moon.age < 14.77 ? { right: 0 } : { left: 0 }),
            borderRadius: "50%",
          }}
        />
      </span>
      <div>
        <p className="eyebrow text-gold-600">Tonight</p>
        <p className="font-serif text-lg leading-tight text-plum-900">{moon.name}</p>
      </div>
    </div>
  );
}
