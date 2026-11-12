"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock, Heart, MapPin, Minus, Plus, Sparkles, Video } from "lucide-react";
import { EVENTS, type GatheringEvent } from "@/lib/content";
import { setState, toggleIn, useApp } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useToast } from "@/components/Providers";
import { Button, DemoTag, Field, IconButton, PageHeader, Sheet } from "@/components/ui";

export default function EventsPage() {
  const app = useApp();
  const toast = useToast();
  const [detail, setDetail] = useState<GatheringEvent | null>(null);
  const [rsvp, setRsvp] = useState<GatheringEvent | null>(null);

  return (
    <div>
      <PageHeader eyebrow="Events & gatherings" title="Gather with your coven." sub="Circles, workshops and evenings together, online and in person.">
        <div className="mt-4">
          <DemoTag>Sample events · not announced by A Good Witch</DemoTag>
        </div>
      </PageHeader>

      <ul className="mt-6 grid gap-5 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-0">
        {EVENTS.map((e) => {
          const signed = app.eventSignups.some((s) => s.eventId === e.id);
          const interested = app.eventInterests.includes(e.id);
          return (
            <li key={e.id} id={e.id} className="card flex scroll-mt-28 flex-col overflow-hidden">
              <div className="relative h-52">
                <Scene name={e.scene} />
                <div className="absolute inset-0 bg-gradient-to-t from-night/70 to-transparent" />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ivory-50/90 px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-plum-900">
                  {e.virtual ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                  {e.virtual ? "Virtual" : "In person"}
                </span>
                <div className="absolute top-3 right-3">
                  <IconButton
                    tone="dark"
                    label={interested ? "Remove from interests" : "Add to my event interests"}
                    active={interested}
                    onClick={() => {
                      setState((s) => ({ eventInterests: toggleIn(s.eventInterests, e.id) }));
                      toast(interested ? "Removed from your interests" : "Added to your event interests");
                    }}
                  >
                    <Heart className="h-4 w-4" fill={interested ? "currentColor" : "none"} />
                  </IconButton>
                </div>
                {signed && (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-plum-950">
                    <Check className="h-3 w-3" /> Spot saved (demo)
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="eyebrow text-gold-600">{e.date}</p>
                <h2 className="display mt-1.5 text-2xl leading-tight text-plum-900">{e.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-plum-700/65">
                  <MapPin className="h-3 w-3" /> {e.location}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-plum-700/80">{e.description}</p>
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetail(e)}>
                    Learn more
                  </Button>
                  <Button size="sm" variant={signed ? "gold" : "primary"} className="flex-1" onClick={() => setRsvp(e)}>
                    {signed ? "Spot saved" : "Save my spot"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mx-auto mt-10 max-w-md px-6 text-center text-xs leading-relaxed text-plum-700/55">
        These are fictional example events created to show how gatherings could be announced and booked in the app. Registration is simulated.
      </p>

      <Sheet open={!!detail} onClose={() => setDetail(null)} eyebrow={detail?.location} title={detail?.title}>
        {detail && (
          <>
            <div className="-mx-6 h-48 overflow-hidden sm:mx-0 sm:rounded-2xl">
              <Scene name={detail.scene} />
            </div>
            <div className="mt-5 space-y-2 text-sm text-plum-800">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gold-600" /> {detail.date}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold-600" /> {detail.time}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold-600" /> {detail.location}
              </p>
            </div>
            <p className="mt-4 leading-relaxed text-plum-800/85">{detail.description}</p>
            <ul className="mt-4 space-y-2">
              {detail.details.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-plum-800">
                  <Sparkles className="h-3.5 w-3.5 text-gold-500" /> {d}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-plum-700/60">{detail.spots} sample spots · fictional event for demonstration</p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                const e = detail;
                setDetail(null);
                setRsvp(e);
              }}
            >
              Save my spot
            </Button>
          </>
        )}
      </Sheet>

      <RsvpSheet event={rsvp} onClose={() => setRsvp(null)} />
    </div>
  );
}

function RsvpSheet({ event, onClose }: { event: GatheringEvent | null; onClose: () => void }) {
  const app = useApp();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState(1);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (!event) return null;
  const existing = app.eventSignups.find((s) => s.eventId === event.id);
  const displayName = name || app.firstName;

  const close = () => {
    setConfirmed(false);
    setError("");
    onClose();
  };

  return (
    <Sheet open onClose={close} eyebrow="Event registration · demo" title={event.title}>
      {confirmed || existing ? (
        <div className="py-4 text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-plum-700">
            <Check className="h-6 w-6" />
          </span>
          <p className="display mt-4 text-3xl text-plum-900">Your spot is saved{existing?.name ? `, ${existing.name}` : ""}.</p>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-plum-700/75">
            In this demonstration, your registration is stored on this device only. No ticket was issued, nothing was emailed, and this
            fictional event has not been scheduled.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={close}>Done</Button>
            {existing && (
              <Button
                variant="ghost"
                onClick={() => {
                  setState((s) => ({ eventSignups: s.eventSignups.filter((x) => x.eventId !== event.id) }));
                  toast("Registration cancelled");
                  close();
                }}
              >
                Cancel my spot
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!displayName.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
              setError("Please add your name and a valid email.");
              return;
            }
            setState((s) => ({
              eventSignups: [...s.eventSignups.filter((x) => x.eventId !== event.id), { eventId: event.id, name: displayName.trim(), email, guests, createdAt: Date.now() }],
              eventInterests: s.eventInterests.includes(event.id) ? s.eventInterests : [...s.eventInterests, event.id],
              firstName: s.firstName || displayName.trim(),
            }));
            setConfirmed(true);
          }}
        >
          <p className="text-sm text-plum-700/80">
            {event.date} · {event.location}
          </p>
          <Field label="First name">
            <input className="field" value={displayName} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Email">
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <div>
            <span className="eyebrow mb-2 block text-plum-700/80">Spots</span>
            <div className="inline-flex items-center gap-4 rounded-full border border-gold-500/30 bg-white px-2 py-1.5">
              <button type="button" aria-label="Fewer spots" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="rounded-full p-1.5 hover:bg-plum-800/5">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-4 text-center tabular-nums">{guests}</span>
              <button type="button" aria-label="More spots" onClick={() => setGuests((g) => Math.min(4, g + 1))} className="rounded-full p-1.5 hover:bg-plum-800/5">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-[#a33a4f]">{error}</p>}
          <Button type="submit" className="w-full">
            Save my spot
          </Button>
          <p className="text-center text-xs text-plum-700/55">Simulated registration. Nothing is sent or booked.</p>
        </form>
      )}
    </Sheet>
  );
}
