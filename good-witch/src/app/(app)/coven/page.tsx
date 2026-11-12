"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, CalendarHeart, Heart, Megaphone, MessageCircle, PenLine, Send, Share2, Star } from "lucide-react";
import {
  ANNOUNCEMENTS,
  BRAND,
  DAILY_DISCUSSION,
  EVENTS,
  MEMBERS,
  POSTS,
  type Post,
  type PostTopic,
  SPOTLIGHT,
} from "@/lib/content";
import { setState, toggleIn, uid, useApp, type LocalPost } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useToast } from "@/components/Providers";
import { Avatar, Button, DemoTag, Field, SectionHeader, Sheet, btn, timeAgo, useShare } from "@/components/ui";

const TOPICS: ("All" | PostTopic)[] = ["All", "Gratitude", "Releasing", "Beautiful moments", "Intentions"];
const COMPOSER_PROMPTS = [
  DAILY_DISCUSSION.prompt,
  "What are you grateful for today?",
  "What is one thing you're working on releasing?",
  "Share something beautiful that happened this week.",
];
const PROMPT_TOPIC: Record<string, string> = {
  [DAILY_DISCUSSION.prompt]: "Daily discussion",
  "What are you grateful for today?": "Gratitude",
  "What is one thing you're working on releasing?": "Releasing",
  "Share something beautiful that happened this week.": "Beautiful moments",
};

export default function CovenPage() {
  const app = useApp();
  const toast = useToast();
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("All");
  const [composer, setComposer] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const feedRef = useRef<HTMLElement>(null);
  const spotlight = MEMBERS.find((m) => m.id === SPOTLIGHT.memberId)!;

  const posts = POSTS.filter((p) => topic === "All" || p.topic === topic);
  const mine = app.localPosts.filter((p) => topic === "All" || p.topic === topic);

  return (
    <div>
      {/* Hero */}
      <section className="relative mx-4 mt-5 overflow-hidden rounded-[1.75rem] text-ivory-50 shadow-[var(--shadow-float)] lg:mx-0 lg:mt-8">
        <div className="absolute inset-0">
          <Scene name="circle" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/50 to-night/10" />
        <div className="relative flex min-h-[26rem] flex-col justify-end p-7 sm:p-10">
          <p className="eyebrow text-gold-300">The Good Coven · Community</p>
          <h1 className="display mt-3 max-w-lg text-[2.5rem] sm:text-5xl">Welcome to the Good Coven.</h1>
          <p className="mt-3 max-w-md leading-relaxed text-lavender-100/80">
            A place to connect, share, grow, and celebrate the magic in everyday life.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="gold" onClick={() => setComposer(DAILY_DISCUSSION.prompt)}>
              Join the Conversation
            </Button>
            <Button variant="outline-light" onClick={() => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Explore Community
            </Button>
          </div>
          <p className="mt-5 text-[0.65rem] text-lavender-200/60">
            Simulated community. Members and posts are fictional; anything you share stays on this device.
          </p>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-0">
        <div className="min-w-0">
          {/* Daily discussion */}
          <section className="card relative overflow-hidden p-6 sm:p-7">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-lavender-200/50 blur-2xl" />
            <p className="eyebrow relative text-gold-600">Daily discussion</p>
            <h2 className="display relative mt-2 text-[1.9rem] leading-tight text-plum-900">{DAILY_DISCUSSION.prompt}</h2>
            <p className="relative mt-2 text-sm text-plum-700/70">{DAILY_DISCUSSION.context}</p>
            <div className="relative mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {MEMBERS.slice(0, 4).map((m) => (
                    <Avatar key={m.id} memberId={m.id} size={30} />
                  ))}
                </div>
                <span className="ml-3 text-xs text-plum-700/70">{DAILY_DISCUSSION.replies.toLocaleString()} sample replies</span>
              </div>
              <Button size="sm" onClick={() => setComposer(DAILY_DISCUSSION.prompt)}>
                <PenLine className="h-3.5 w-3.5" /> Share yours
              </Button>
            </div>
          </section>

          {/* Feed */}
          <section ref={feedRef} className="mt-10 scroll-mt-32">
            <SectionHeader eyebrow="Community feed" title="From the coven" action={<DemoTag>Fictional members</DemoTag>} />
            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={topic === t}
                  onClick={() => setTopic(t)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                    topic === t ? "border-plum-800 bg-plum-800 text-ivory-50" : "border-plum-800/15 bg-ivory-50 text-plum-800 hover:border-plum-800/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setComposer(COMPOSER_PROMPTS[1])}
              className="card mb-4 flex w-full items-center gap-3 p-3.5 text-left transition hover:border-gold-500/40"
            >
              <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={38} />
              <span className="flex-1 text-sm text-plum-700/60">Share something with the coven…</span>
              <span className={btn("primary", "sm")}>Post</span>
            </button>

            <ul className="space-y-4">
              {mine.map((p) => (
                <LocalPostCard key={p.id} post={p} />
              ))}
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onComments={() => setCommentsFor(p.id)} />
              ))}
              {!posts.length && !mine.length && (
                <li className="card p-8 text-center text-sm text-plum-700/70">No posts in this circle yet. Be the first to share.</li>
              )}
            </ul>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="card-dark overflow-hidden">
            <div className="relative h-28">
              <Scene name="botanical" />
              <div className="absolute inset-0 bg-gradient-to-t from-plum-900 to-transparent" />
            </div>
            <div className="relative -mt-10 px-6 pb-6">
              <Avatar memberId={spotlight.id} size={64} />
              <p className="eyebrow mt-3 flex items-center gap-1.5 text-gold-300">
                <Star className="h-3 w-3" fill="currentColor" /> {SPOTLIGHT.title}
              </p>
              <p className="display mt-1 text-2xl">{spotlight.name}</p>
              <p className="text-xs text-lavender-200/60">
                @{spotlight.handle} · {spotlight.location} · member since {spotlight.since}
              </p>
              <p className="mt-4 font-serif text-lg leading-snug text-lavender-100 italic">“{SPOTLIGHT.quote}”</p>
              <ul className="mt-4 space-y-1.5 text-sm text-lavender-100/75">
                {SPOTLIGHT.details.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="text-gold-300">✦</span> {d}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[0.62rem] uppercase tracking-[0.18em] text-lavender-200/40">Fictional member</p>
            </div>
          </section>

          <section className="card p-6">
            <p className="eyebrow flex items-center gap-2 text-gold-600">
              <Megaphone className="h-3.5 w-3.5" /> Announcements from {BRAND.creator}
            </p>
            <ul className="mt-4 space-y-4">
              {ANNOUNCEMENTS.map((a) => (
                <li key={a.id} className="border-l-2 border-gold-400/60 pl-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-plum-700/50">{a.date}</p>
                  <p className="display mt-0.5 text-lg leading-tight text-plum-900">{a.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-plum-700/75">{a.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <p className="eyebrow flex items-center gap-2 text-gold-600">
              <CalendarHeart className="h-3.5 w-3.5" /> Upcoming gatherings
            </p>
            <ul className="mt-4 space-y-3">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <Link href={`/events#${e.id}`} className="group flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <Scene name={e.scene} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-lg leading-tight text-plum-900 group-hover:text-plum-600">{e.title}</p>
                      <p className="text-xs text-plum-700/60">{e.location}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-plum-700/40 transition group-hover:translate-x-0.5 group-hover:text-plum-800" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/events" className={btn("outline", "sm", "mt-5 w-full")}>
              See all events
            </Link>
          </section>
        </aside>
      </div>

      <Composer
        prompt={composer}
        onClose={() => setComposer(null)}
        onPost={(post) => {
          setState((s) => ({ localPosts: [post, ...s.localPosts] }));
          setComposer(null);
          setTopic("All");
          toast("Shared with your coven (on this device only)");
          window.setTimeout(() => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }}
      />
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </div>
  );
}

/* ---------------- Post cards ---------------- */

function PostCard({ post, onComments }: { post: Post; onComments: () => void }) {
  const app = useApp();
  const share = useShare();
  const m = MEMBERS.find((x) => x.id === post.memberId)!;
  const liked = app.likedPosts.includes(post.id);
  const extra = app.localComments[post.id]?.length ?? 0;

  return (
    <li className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar memberId={m.id} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-plum-900">{m.name}</p>
            <p className="text-xs text-plum-700/55">
              @{m.handle} · {post.ago}
            </p>
          </div>
          <span className="rounded-full bg-lavender-100 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-plum-700">{post.topic}</span>
        </div>
        <p className="mt-4 font-serif text-[1.05rem] text-plum-700/70 italic">{post.prompt}</p>
        <p className="mt-1.5 leading-relaxed text-plum-900">{post.body}</p>
      </div>
      {post.scene && (
        <div className="mx-5 mb-4 h-52 overflow-hidden rounded-xl">
          <Scene name={post.scene} />
        </div>
      )}
      <div className="flex items-center gap-1 border-t border-gold-500/15 px-3 py-2">
        <button
          type="button"
          aria-pressed={liked}
          onClick={() => setState((s) => ({ likedPosts: toggleIn(s.likedPosts, post.id) }))}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-plum-800/5 ${liked ? "text-[#a33a6b]" : "text-plum-700"}`}
        >
          <Heart className={`h-4 w-4 transition ${liked ? "scale-110" : ""}`} fill={liked ? "currentColor" : "none"} />
          {post.likes + (liked ? 1 : 0)}
        </button>
        <button type="button" onClick={onComments} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-plum-700 hover:bg-plum-800/5">
          <MessageCircle className="h-4 w-4" />
          {post.comments.length + extra}
        </button>
        <button
          type="button"
          onClick={() => share(`${post.prompt}\n“${post.body}”`, "From the Good Coven")}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-plum-700 hover:bg-plum-800/5"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </li>
  );
}

function LocalPostCard({ post }: { post: LocalPost }) {
  const app = useApp();
  return (
    <li className="card animate-rise overflow-hidden border-gold-400/50">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-plum-900">{app.firstName || "You"}</p>
            <p className="text-xs text-plum-700/55">Visible only on this device · {timeAgo(post.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={() => setState((s) => ({ localPosts: s.localPosts.filter((p) => p.id !== post.id) }))}
            className="text-xs uppercase tracking-[0.14em] text-plum-700/50 hover:text-plum-900"
          >
            Remove
          </button>
        </div>
        <p className="mt-4 font-serif text-[1.05rem] text-plum-700/70 italic">{post.prompt}</p>
        <p className="mt-1.5 leading-relaxed whitespace-pre-wrap text-plum-900">{post.body}</p>
      </div>
    </li>
  );
}

/* ---------------- Composer ---------------- */

function Composer({ prompt, onClose, onPost }: { prompt: string | null; onClose: () => void; onPost: (p: LocalPost) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const active = chosen ?? prompt ?? COMPOSER_PROMPTS[0];

  return (
    <Sheet
      open={prompt !== null}
      onClose={() => {
        setChosen(null);
        onClose();
      }}
      eyebrow="Join the conversation"
      title="Share with the coven"
    >
      <p className="eyebrow mb-2 text-plum-700/80">Respond to a prompt</p>
      <div className="flex flex-col gap-2">
        {COMPOSER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={active === p}
            onClick={() => setChosen(p)}
            className={`rounded-xl border px-4 py-2.5 text-left font-serif text-[1.02rem] transition ${
              active === p ? "border-plum-700 bg-lavender-100 text-plum-900" : "border-plum-800/10 text-plum-800 hover:border-plum-800/30"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          onPost({ id: uid(), prompt: active, topic: PROMPT_TOPIC[active] ?? "Gratitude", body: body.trim(), createdAt: Date.now() });
          setBody("");
          setChosen(null);
        }}
      >
        <Field label="Your share" hint="This is a simulation: your post is stored in this browser only and is never sent anywhere.">
          <textarea className="field min-h-32 resize-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write from the heart…" autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={!body.trim()}>
          <Send className="h-4 w-4" /> Share with the coven
        </Button>
      </form>
    </Sheet>
  );
}

/* ---------------- Comments ---------------- */

function CommentsSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const app = useApp();
  const [text, setText] = useState("");
  const post = POSTS.find((p) => p.id === postId);
  if (!post) return null;
  const local = app.localComments[post.id] ?? [];

  return (
    <Sheet open onClose={onClose} eyebrow={post.prompt} title="Conversation">
      <ul className="space-y-4">
        {post.comments.map((c) => {
          const m = MEMBERS.find((x) => x.id === c.memberId)!;
          return (
            <li key={c.id} className="flex gap-3">
              <Avatar memberId={m.id} size={32} />
              <div className="rounded-2xl rounded-tl-sm bg-lavender-100/70 px-4 py-2.5">
                <p className="text-xs font-medium text-plum-900">{m.name}</p>
                <p className="text-sm text-plum-800">{c.body}</p>
              </div>
            </li>
          );
        })}
        {local.map((c) => (
          <li key={c.id} className="animate-rise flex gap-3">
            <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={32} />
            <div className="rounded-2xl rounded-tl-sm border border-gold-400/40 bg-ivory-50 px-4 py-2.5">
              <p className="text-xs font-medium text-plum-900">{app.firstName || "You"} · on this device</p>
              <p className="text-sm text-plum-800">{c.body}</p>
            </div>
          </li>
        ))}
        {!post.comments.length && !local.length && <li className="text-sm text-plum-700/60">No replies yet. Offer the first kind word.</li>}
      </ul>
      <form
        className="sticky bottom-0 mt-5 flex gap-2 bg-ivory-50 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setState((s) => ({
            localComments: { ...s.localComments, [post.id]: [...(s.localComments[post.id] ?? []), { id: uid(), body: text.trim(), createdAt: Date.now() }] },
          }));
          setText("");
        }}
      >
        <input className="field" placeholder="Add a kind reply…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Reply" />
        <Button type="submit" aria-label="Send reply" disabled={!text.trim()} className="!px-4">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Sheet>
  );
}
