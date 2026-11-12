"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, CalendarHeart, Feather, Heart, MessageCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { AFFIRMATIONS, EVENTS, FEATURES, POSTS, todaysMagic } from "@/lib/content";
import { resetState, setHash, setState, toggleIn, useApp, useHash, useHydrated } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { AboutConcept } from "@/components/AppShell";
import { useFeatureSheet } from "@/components/features";
import { useToast } from "@/components/Providers";
import { Avatar, Button, Empty, Sheet, btn, timeAgo } from "@/components/ui";

const TABS = [
  { id: "affirmations", label: "Affirmations", icon: Bookmark },
  { id: "reflections", label: "Reflections", icon: Feather },
  { id: "favorites", label: "Favourites", icon: Heart },
  { id: "community", label: "Community", icon: MessageCircle },
  { id: "events", label: "Events", icon: CalendarHeart },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HUES = [285, 320, 250, 200, 150, 30];

export default function ProfilePage() {
  const app = useApp();
  const hydrated = useHydrated();
  const toast = useToast();
  const hash = useHash();
  const tab: Tab = TABS.some((t) => t.id === hash) ? (hash as Tab) : "affirmations";
  const [edit, setEdit] = useState(false);
  const [about, setAbout] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState("");

  const counts: Record<Tab, number> = {
    affirmations: new Set([...app.savedAffirmations, ...app.favoriteAffirmations]).size + app.savedMessages.length,
    reflections: app.journal.length,
    favorites: app.favoriteContent.length + app.favoriteAffirmations.length,
    community: app.localPosts.length + app.likedPosts.length + Object.values(app.localComments).flat().length,
    events: app.eventInterests.length + app.eventSignups.length + app.readingRequests.length,
  };

  return (
    <div>
      {/* Header */}
      <section className="relative mx-4 mt-5 overflow-hidden rounded-[1.75rem] text-ivory-50 shadow-[var(--shadow-float)] lg:mx-0 lg:mt-8">
        <div className="absolute inset-0 opacity-80">
          <Scene name="moon" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-plum-950 via-plum-950/70 to-plum-950/30" />
        <div className="relative flex flex-col items-center px-6 pt-10 pb-7 text-center sm:flex-row sm:items-end sm:text-left">
          <div className="relative">
            <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={96} />
            <button
              type="button"
              aria-label="Edit profile"
              onClick={() => {
                setDraft(app.firstName);
                setEdit(true);
              }}
              className="absolute -right-1 -bottom-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 text-plum-950 shadow-lg"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-6">
            <p className="eyebrow text-gold-300">My magic</p>
            <h1 className="display mt-1 text-4xl">{hydrated ? app.firstName || "Welcome, witch" : " "}</h1>
            <p className="mt-1 text-sm text-lavender-100/70">
              {app.visits.length} {app.visits.length === 1 ? "day" : "days"} of magic · {app.journal.length} journal entries
            </p>
          </div>
          <div className="mt-5 sm:mt-0 sm:ml-auto">
            <Button
              variant="outline-light"
              size="sm"
              onClick={() => {
                setDraft(app.firstName);
                setEdit(true);
              }}
            >
              Edit profile
            </Button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto px-4 lg:px-0" role="tablist" aria-label="Saved content">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setHash(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition ${
              tab === t.id ? "border-plum-800 bg-plum-800 text-ivory-50" : "border-plum-800/15 bg-ivory-50 text-plum-800 hover:border-plum-800/40"
            }`}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.5} />
            {t.label}
            {hydrated && counts[t.id] > 0 && (
              <span className={`rounded-full px-1.5 text-[0.65rem] ${tab === t.id ? "bg-gold-400 text-plum-950" : "bg-lavender-100 text-plum-700"}`}>{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-rise mt-5 px-4 lg:px-0">
        {hydrated && tab === "affirmations" && <SavedAffirmations />}
        {hydrated && tab === "reflections" && <Reflections />}
        {hydrated && tab === "favorites" && <Favorites />}
        {hydrated && tab === "community" && <Community />}
        {hydrated && tab === "events" && <EventsTab />}
      </div>

      <div className="mt-12 flex flex-col items-center gap-2 px-4">
        <button type="button" onClick={() => setAbout(true)} className="text-xs uppercase tracking-[0.18em] text-plum-700 hover:text-plum-900">
          About this concept
        </button>
        <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 text-xs text-plum-700/50 hover:text-plum-800">
          <RotateCcw className="h-3 w-3" /> Reset demo data
        </button>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} eyebrow="Your profile" title="Make it yours">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setState({ firstName: draft.trim().slice(0, 30) });
            setEdit(false);
            toast("Profile updated");
          }}
        >
          <label className="block">
            <span className="eyebrow mb-2 block text-plum-700/80">First name</span>
            <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What should we call you?" autoFocus />
          </label>
          <div>
            <span className="eyebrow mb-2 block text-plum-700/80">Profile colour</span>
            <div className="flex gap-3">
              {HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`Colour ${h}`}
                  aria-pressed={app.avatarHue === h}
                  onClick={() => setState({ avatarHue: h })}
                  className={`rounded-full transition ${app.avatarHue === h ? "ring-2 ring-gold-500 ring-offset-2 ring-offset-ivory-50" : ""}`}
                >
                  <Avatar hue={h} initial={(draft || "W")[0].toUpperCase()} size={40} />
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-plum-700/60">No account needed. Your profile is stored in this browser only.</p>
          <Button type="submit" className="w-full">
            Save profile
          </Button>
        </form>
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Start fresh?">
        <p className="text-plum-800/85">This clears your saved affirmations, journal, posts, bag and registrations from this browser.</p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmReset(false)}>
            Keep everything
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              resetState();
              setConfirmReset(false);
              toast("Demo data cleared");
            }}
          >
            Reset
          </Button>
        </div>
      </Sheet>
      <AboutConcept open={about} onClose={() => setAbout(false)} />
    </div>
  );
}

/* ---------------- Tabs ---------------- */

function SavedAffirmations() {
  const app = useApp();
  const ids = Array.from(new Set([...app.savedAffirmations, ...app.favoriteAffirmations]));
  const items = AFFIRMATIONS.filter((a) => ids.includes(a.id));
  if (!items.length && !app.savedMessages.length)
    return (
      <Empty
        title="No saved affirmations yet"
        body="Tap the bookmark on any affirmation or “Save this message” on Today's Magic."
        action={
          <Link href="/daily" className={btn("primary", "sm")}>
            Find an affirmation
          </Link>
        }
      />
    );
  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((a) => {
            const fav = app.favoriteAffirmations.includes(a.id);
            const saved = app.savedAffirmations.includes(a.id);
            return (
              <li key={a.id} className="card-dark relative overflow-hidden p-6">
                <p className="eyebrow text-gold-300">{a.theme}</p>
                <p className="display mt-2 text-2xl leading-snug">“{a.text}”</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    aria-label={saved ? "Unsave" : "Save"}
                    onClick={() => setState((s) => ({ savedAffirmations: toggleIn(s.savedAffirmations, a.id) }))}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${saved ? "border-gold-400 bg-gold-400 text-plum-950" : "border-ivory-50/25"}`}
                  >
                    <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    aria-label={fav ? "Unfavourite" : "Favourite"}
                    onClick={() => setState((s) => ({ favoriteAffirmations: toggleIn(s.favoriteAffirmations, a.id) }))}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${fav ? "border-gold-400 bg-gold-400 text-plum-950" : "border-ivory-50/25"}`}
                  >
                    <Heart className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {app.savedMessages.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Saved daily messages</h3>
          <ul className="space-y-3">
            {app.savedMessages.map((key) => {
              const d = new Date(key);
              const valid = !Number.isNaN(d.getTime());
              const m = todaysMagic(valid ? d : new Date());
              return (
                <li key={key} className="card flex items-start gap-4 p-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg">
                    <Scene name={m.scene} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow text-gold-600">{valid ? d.toLocaleDateString(undefined, { month: "long", day: "numeric" }) : "Saved"}</p>
                    <p className="mt-1 font-serif text-lg leading-snug text-plum-900">“{m.affirmation.text}”</p>
                    <p className="mt-1 text-sm text-plum-700/70">{m.message}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove saved message"
                    onClick={() => setState((s) => ({ savedMessages: s.savedMessages.filter((x) => x !== key) }))}
                    className="rounded-full p-1.5 text-plum-700/40 hover:text-plum-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Reflections() {
  const app = useApp();
  const [filter, setFilter] = useState<"all" | "reflection" | "release" | "intention">("all");
  const entries = app.journal.filter((e) => filter === "all" || e.kind === filter);
  if (!app.journal.length)
    return (
      <Empty
        title="Your journal is waiting"
        body="Reflections, releases and intentions you save in Daily Magic appear here, private to you."
        action={
          <Link href="/daily#reflection" className={btn("primary", "sm")}>
            Write a reflection
          </Link>
        }
      />
    );
  const label = { reflection: "Reflection", release: "Released", intention: "Intention" };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", "reflection", "release", "intention"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs capitalize transition ${filter === f ? "bg-plum-800 text-ivory-50" : "text-plum-700 hover:bg-plum-800/5"}`}
          >
            {f === "all" ? "All entries" : label[f] + "s"}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="eyebrow text-gold-600">
                {label[e.kind]}
                {e.tag ? ` · ${e.tag}` : ""} · {timeAgo(e.createdAt)}
              </p>
              <button
                type="button"
                aria-label="Delete entry"
                onClick={() => setState((s) => ({ journal: s.journal.filter((x) => x.id !== e.id) }))}
                className="rounded-full p-1 text-plum-700/40 hover:text-plum-900"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 font-serif text-plum-700/70 italic">{e.prompt}</p>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap text-plum-900">{e.text}</p>
          </li>
        ))}
        {!entries.length && <li className="text-sm text-plum-700/60">No entries of this kind yet.</li>}
      </ul>
    </div>
  );
}

function Favorites() {
  const app = useApp();
  const { open, sheet } = useFeatureSheet();
  const content = FEATURES.filter((f) => app.favoriteContent.includes(f.id));
  const affs = AFFIRMATIONS.filter((a) => app.favoriteAffirmations.includes(a.id));
  if (!content.length && !affs.length)
    return (
      <Empty
        title="No favourites yet"
        body="Heart an affirmation or a message from Shelley to keep it close."
        action={
          <Link href="/home" className={btn("primary", "sm")}>
            Explore today&apos;s magic
          </Link>
        }
      />
    );
  return (
    <div className="space-y-6">
      {content.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Favourite content</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {content.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => open(f.id)} className="card flex w-full items-center gap-4 p-3 text-left">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                    <Scene name={f.scene} />
                  </div>
                  <div>
                    <p className="eyebrow text-gold-600">
                      {f.kind} · {f.duration}
                    </p>
                    <p className="display mt-1 text-lg leading-tight text-plum-900">{f.title}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {affs.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Favourite affirmations</h3>
          <ul className="space-y-2">
            {affs.map((a) => (
              <li key={a.id} className="card flex items-center gap-3 px-5 py-4">
                <Heart className="h-4 w-4 shrink-0 text-plum-600" fill="currentColor" />
                <p className="font-serif text-lg text-plum-900">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sheet}
    </div>
  );
}

function Community() {
  const app = useApp();
  const liked = POSTS.filter((p) => app.likedPosts.includes(p.id));
  const comments = Object.entries(app.localComments).flatMap(([postId, cs]) => cs.map((c) => ({ ...c, post: POSTS.find((p) => p.id === postId) })));
  if (!app.localPosts.length && !liked.length && !comments.length)
    return (
      <Empty
        title="No community activity yet"
        body="Share, reply or heart a post in the Good Coven and it will show up here."
        action={
          <Link href="/coven" className={btn("primary", "sm")}>
            Visit the coven
          </Link>
        }
      />
    );
  return (
    <div className="space-y-6">
      {app.localPosts.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Your posts</h3>
          <ul className="space-y-3">
            {app.localPosts.map((p) => (
              <li key={p.id} className="card p-5">
                <p className="eyebrow text-gold-600">
                  {p.topic} · {timeAgo(p.createdAt)}
                </p>
                <p className="mt-1 font-serif text-plum-700/70 italic">{p.prompt}</p>
                <p className="mt-1.5 text-plum-900">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {comments.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Your replies</h3>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="card px-5 py-4">
                <p className="text-xs text-plum-700/60">On “{c.post?.prompt}”</p>
                <p className="mt-1 text-plum-900">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {liked.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Posts you loved</h3>
          <ul className="space-y-2">
            {liked.map((p) => (
              <li key={p.id} className="card flex items-start gap-3 px-5 py-4">
                <Avatar memberId={p.memberId} size={32} />
                <p className="text-sm leading-relaxed text-plum-900">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/coven" className={btn("outline", "sm")}>
        Back to the coven
      </Link>
    </div>
  );
}

function EventsTab() {
  const app = useApp();
  const interests = EVENTS.filter((e) => app.eventInterests.includes(e.id));
  if (!interests.length && !app.eventSignups.length && !app.readingRequests.length)
    return (
      <Empty
        title="No event interests yet"
        body="Heart an event or save your spot to keep track of the gatherings you love."
        action={
          <Link href="/events" className={btn("primary", "sm")}>
            Browse events
          </Link>
        }
      />
    );
  return (
    <div className="space-y-6">
      {interests.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Event interests</h3>
          <ul className="space-y-3">
            {interests.map((e) => {
              const signup = app.eventSignups.find((s) => s.eventId === e.id);
              return (
                <li key={e.id}>
                  <Link href={`/events#${e.id}`} className="card flex items-center gap-4 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <Scene name={e.scene} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg leading-tight text-plum-900">{e.title}</p>
                      <p className="text-xs text-plum-700/60">{e.location}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[0.62rem] uppercase tracking-[0.14em] ${signup ? "bg-gold-400 text-plum-950" : "bg-lavender-100 text-plum-700"}`}>
                      {signup ? `Spot saved · ${signup.guests}` : "Interested"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {app.readingRequests.length > 0 && (
        <div>
          <h3 className="display mb-3 text-xl text-plum-900">Reading requests (demo)</h3>
          <ul className="space-y-3">
            {app.readingRequests.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="eyebrow text-gold-600">
                    Private 1:1 Tarot Reading · {new Date(r.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {r.time}
                  </p>
                  <button
                    type="button"
                    aria-label="Remove request"
                    onClick={() => setState((s) => ({ readingRequests: s.readingRequests.filter((x) => x.id !== r.id) }))}
                    className="rounded-full p-1 text-plum-700/40 hover:text-plum-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-plum-900">{r.focus}</p>
                <p className="mt-2 text-xs text-plum-700/55">Simulated request · not sent, not booked</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
