"use client";

/**
 * Prototype persistence: one small external store mirrored to localStorage.
 * No accounts, no backend. Everything stays on this device.
 */
import { useSyncExternalStore } from "react";

export type JournalKind = "reflection" | "release" | "intention";

export type JournalEntry = {
  id: string;
  kind: JournalKind;
  prompt: string;
  text: string;
  tag?: string;
  createdAt: number;
};

export type LocalPost = {
  id: string;
  prompt: string;
  topic: string;
  body: string;
  createdAt: number;
};

export type LocalComment = { id: string; body: string; createdAt: number };

export type EventSignup = { eventId: string; name: string; email: string; guests: number; createdAt: number };

export type ReadingRequest = {
  id: string;
  firstName: string;
  email: string;
  date: string;
  time: string;
  focus: string;
  createdAt: number;
};

export type CartLine = { slug: string; qty: number };

export type AppState = {
  firstName: string;
  avatarHue: number;
  savedAffirmations: string[];
  favoriteAffirmations: string[];
  savedMessages: string[]; // day keys of saved "Today's magic" messages
  favoriteContent: string[];
  journal: JournalEntry[];
  likedPosts: string[];
  localPosts: LocalPost[];
  localComments: Record<string, LocalComment[]>;
  eventInterests: string[];
  eventSignups: EventSignup[];
  readingRequests: ReadingRequest[];
  cart: CartLine[];
  covenInterest: boolean;
  visits: string[];
};

export const DEFAULT_STATE: AppState = {
  firstName: "",
  avatarHue: 285,
  savedAffirmations: [],
  favoriteAffirmations: [],
  savedMessages: [],
  favoriteContent: [],
  journal: [],
  likedPosts: [],
  localPosts: [],
  localComments: {},
  eventInterests: [],
  eventSignups: [],
  readingRequests: [],
  cart: [],
  covenInterest: false,
  visits: [],
};

const KEY = "a-good-witch:concept:v1";

let state: AppState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable (private mode) — the prototype still works in memory */
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!state.visits.includes(today)) state = { ...state, visits: [...state.visits, today].slice(-60) };
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  load();
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function resetState() {
  state = { ...DEFAULT_STATE, visits: [new Date().toISOString().slice(0, 10)] };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue) {
      state = { ...DEFAULT_STATE, ...JSON.parse(e.newValue) };
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

const getServerSnapshot = () => DEFAULT_STATE;

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True once the client has read localStorage (avoids flashing empty states). */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* ---------- helpers ---------- */

export const uid = () => Math.random().toString(36).slice(2, 10);

export function toggleIn(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function addToCart(slug: string, qty = 1) {
  setState((s) => {
    const existing = s.cart.find((l) => l.slug === slug);
    return {
      cart: existing
        ? s.cart.map((l) => (l.slug === slug ? { ...l, qty: Math.min(l.qty + qty, 10) } : l))
        : [...s.cart, { slug, qty }],
    };
  });
}

export function setQty(slug: string, qty: number) {
  setState((s) => ({
    cart: qty <= 0 ? s.cart.filter((l) => l.slug !== slug) : s.cart.map((l) => (l.slug === slug ? { ...l, qty: Math.min(qty, 10) } : l)),
  }));
}

export function addJournal(entry: Omit<JournalEntry, "id" | "createdAt">) {
  setState((s) => ({ journal: [{ ...entry, id: uid(), createdAt: Date.now() }, ...s.journal] }));
}

/** Today's date as a key, computed on the client only. */
export function useTodayKey() {
  return useSyncExternalStore(
    () => () => {},
    () => new Date().toDateString(),
    () => "",
  );
}

/* ---------- URL hash (deep links such as /daily#release) ---------- */

const hashListeners = new Set<() => void>();
function subscribeHash(cb: () => void) {
  hashListeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    hashListeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}

export function useHash() {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
}

export function setHash(h: string) {
  window.history.replaceState(null, "", `#${h}`);
  hashListeners.forEach((l) => l());
}
