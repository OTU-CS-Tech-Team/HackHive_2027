"use client";

import { useEffect, useState } from "react";
import type { EventCategory, HackEvent } from "@/lib/content";
import { formatDay, formatTime } from "@/lib/time";
import { getSupabaseBrowserClient } from "@/supabase/browser-client";

// Full class strings so Tailwind picks them up.
export const CATEGORIES: Record<EventCategory, { label: string; bar: string; chip: string }> = {
  hackhive: { label: "HackHive", bar: "bg-amber-400", chip: "bg-amber-100 text-amber-900 border-amber-300" },
  workshop: { label: "Sponsor workshops", bar: "bg-sky-500", chip: "bg-sky-100 text-sky-900 border-sky-300" },
  fun: { label: "Fun events", bar: "bg-fuchsia-500", chip: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
  food: { label: "Food", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  ceremony: { label: "Ceremonies", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-900 border-violet-300" },
};

export function Schedule({ initialEvents }: { initialEvents: HackEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set());
  // Set after mount: reading the clock during render would differ server vs browser.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Any insert/update/delete on events refetches the list, so room or time
  // changes reach everyone with the page open. The server copy can be a few
  // minutes stale, so fetch once on mount too.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const refetch = async () => {
      const { data } = await supabase.from("events").select("*").order("starts_at");
      if (data) setEvents(data as HackEvent[]);
    };
    void refetch();
    const channel = supabase
      .channel("schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refetch)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const toggle = (category: EventCategory) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(category)) next.add(category);
      return next;
    });

  const days = new Map<string, HackEvent[]>();
  for (const event of events) {
    if (hidden.has(event.category)) continue;
    const day = formatDay(event.starts_at);
    days.set(day, [...(days.get(day) ?? []), event]);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {(Object.keys(CATEGORIES) as EventCategory[]).map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={!hidden.has(category)}
            onClick={() => toggle(category)}
            className={`rounded-full border px-3 py-1 text-sm ${
              hidden.has(category) ? "border-neutral-300 text-neutral-400 line-through" : CATEGORIES[category].chip
            }`}
          >
            {CATEGORIES[category].label}
          </button>
        ))}
      </div>

      {days.size === 0 && <p className="text-neutral-600">Nothing scheduled yet. Check back soon.</p>}

      {[...days].map(([day, dayEvents]) => (
        <section key={day} className="mb-10">
          <h2 className="sticky top-16 z-10 mb-3 bg-white py-2 text-xl font-semibold">{day}</h2>
          <ol className="flex flex-col gap-3">
            {dayEvents.map((event) => {
              const live = now !== null && Date.parse(event.starts_at) <= now && now < Date.parse(event.ends_at);
              const over = now !== null && Date.parse(event.ends_at) <= now;
              return (
                <li
                  key={event.id}
                  className={`flex overflow-hidden rounded-lg border ${live ? "border-neutral-900 shadow-md" : "border-neutral-200"} ${over ? "opacity-50" : ""}`}
                >
                  <span className={`w-1.5 shrink-0 ${CATEGORIES[event.category].bar}`} aria-hidden />
                  <div className="flex-1 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <span className="text-sm text-neutral-600">
                        {formatTime(event.starts_at)} – {formatTime(event.ends_at)}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">
                      {CATEGORIES[event.category].label}
                      {event.location && ` · ${event.location}`}
                      {event.host && ` · Hosted by ${event.host}`}
                      {event.points > 0 && ` · ${event.points} pts`}
                    </p>
                    {event.description && <p className="mt-2 text-sm">{event.description}</p>}
                    {live && <p className="mt-2 text-xs font-semibold uppercase tracking-wide">Happening now</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
