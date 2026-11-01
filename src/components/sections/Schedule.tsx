"use client";

import { useEffect, useRef, useState } from "react";
import type { EventCategory, HackEvent } from "@/lib/content";
import { colorOf, layoutLanes, scheduleDays } from "@/lib/schedule";
import { formatDay, formatTime, toLocalInput } from "@/lib/time";
import { createClient } from "@/lib/supabase/client";

const HOUR = 3_600_000;
// 72px per hour, so a 30-minute event still fits its title and time.
const HOUR_PX = 72;
const px = (ms: number) => (ms / HOUR) * HOUR_PX;
// Spreadsheet-style row lines: solid on the hour, faint on the half hour.
const GRID_LINES = {
  backgroundImage:
    "linear-gradient(to bottom, rgb(212 212 212) 1px, transparent 1px), linear-gradient(to bottom, rgb(240 240 240) 1px, transparent 1px)",
  backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
};

export function Schedule({ initialEvents, initialCategories }: { initialEvents: HackEvent[]; initialCategories: EventCategory[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [categories, setCategories] = useState(initialCategories);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<HackEvent | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // Set after mount: reading the clock during render would differ server vs browser.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Any insert/update/delete on events or categories refetches both, so room,
  // time, and colour changes reach everyone with the page open. The server copy can be a few
  // minutes stale, so fetch once on mount too.
  useEffect(() => {
    const supabase = createClient();
    const refetch = async () => {
      const [{ data: eventRows }, { data: categoryRows }] = await Promise.all([
        supabase.from("events").select("*").order("starts_at"),
        supabase.from("event_categories").select("*").order("sort_order"),
      ]);
      if (eventRows) setEvents(eventRows as HackEvent[]);
      if (categoryRows) setCategories(categoryRows as EventCategory[]);
    };
    void refetch();
    const channel = supabase
      .channel("schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_categories" }, refetch)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const days = scheduleDays(events);
  if (days.size === 0) return <p className="text-neutral-600">Nothing scheduled yet. Check back soon.</p>;

  // Open on today during the event, otherwise the first day.
  const today = now === null ? null : toLocalInput(new Date(now).toISOString()).slice(0, 10);
  const active = day && days.has(day) ? day : today && days.has(today) ? today : [...days.keys()][0];
  const { events: dayEvents, start: dayStart, end: dayEnd } = days.get(active)!;
  // Only categories with something on this day, in the order admins set.
  const dayCategories = categories.filter((c) => dayEvents.some((e) => e.category_id === c.id));
  const columns = dayCategories.filter((c) => !hidden.has(c.id));
  // Toronto is a whole-hour offset from UTC, so flooring to the UTC hour lands on a local hour too.
  const start = Math.max(dayStart, Math.floor(Math.min(...dayEvents.map((e) => Date.parse(e.starts_at))) / HOUR) * HOUR);
  const end = Math.min(dayEnd, Math.ceil(Math.max(...dayEvents.map((e) => Date.parse(e.ends_at))) / HOUR) * HOUR);
  const hours = Array.from({ length: (end - start) / HOUR }, (_, i) => start + i * HOUR);
  const selectedCategory = selected && categories.find((c) => c.id === selected.category_id);
  const nowTop = now !== null && now >= start && now < end ? px(now - start) : null;
  const nowLine = nowTop !== null && (
    <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: nowTop }} aria-hidden />
  );

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Day">
        {[...days].map(([key, value]) => {
          const [weekday, date] = value.label.split(", ");
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === active}
              onClick={() => setDay(key)}
              className={`shrink-0 rounded-lg border px-4 py-2 text-left leading-tight ${
                key === active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              <span className="block font-semibold">{weekday}</span>
              <span className="block text-xs opacity-75">{date}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {dayCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={!hidden.has(category.id)}
            onClick={() => toggle(category.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              hidden.has(category.id) ? "border-neutral-300 text-neutral-400 line-through" : colorOf(category.color).chip
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Own scroll box so the header row and time column stay frozen, like a spreadsheet.
          On phones the columns keep a readable width and scroll sideways. */}
      <div className="max-h-[75dvh] overflow-auto overscroll-contain rounded-lg border border-neutral-300">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(8.5rem, 1fr))`,
            minWidth: `${3.5 + columns.length * 8.5}rem`,
          }}
        >
          <div className="sticky top-0 left-0 z-40 border-r border-b border-neutral-300 bg-neutral-50" />
          {columns.map((category) => (
            <div
              key={category.id}
              className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-l border-neutral-300 bg-neutral-50 px-2 py-2 text-xs font-semibold"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${colorOf(category.color).bar}`} aria-hidden />
              {category.name}
            </div>
          ))}

          <div className="sticky left-0 z-30 border-r border-neutral-300 bg-neutral-50" style={GRID_LINES}>
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((hour, i) => (
                <span key={hour} className="absolute right-1.5 text-[11px] text-neutral-500" style={{ top: i * HOUR_PX + 2 }}>
                  {formatTime(new Date(hour).toISOString()).replace(":00", "")}
                </span>
              ))}
              {nowLine}
            </div>
          </div>

          {columns.map((category) => (
            <div key={category.id} className="relative border-l border-neutral-200" style={{ ...GRID_LINES, height: hours.length * HOUR_PX }}>
              {layoutLanes(dayEvents.filter((e) => e.category_id === category.id)).map(({ event, lane, lanes }) => {
                const s = Date.parse(event.starts_at);
                const e = Date.parse(event.ends_at);
                const live = now !== null && s <= now && now < e;
                const over = now !== null && e <= now;
                const visibleStart = Math.max(s, dayStart), visibleEnd = Math.min(e, dayEnd);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelected(event)}
                    className={`absolute overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm hover:z-10 hover:shadow-md ${
                      colorOf(category.color).chip
                    } ${live ? "z-10 ring-2 ring-neutral-900" : ""} ${over ? "opacity-50" : ""}`}
                    style={{
                      top: px(visibleStart - start) + 1,
                      height: Math.max(px(visibleEnd - visibleStart) - 2, 20),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <span className="block font-semibold">{event.title}</span>
                    <span className="block opacity-80">
                      {formatTime(new Date(visibleStart).toISOString())} – {formatTime(new Date(visibleEnd).toISOString())}
                    </span>
                    {s < dayStart && <span className="block">Continued from previous day</span>}
                    {e > dayEnd && <span className="block">Continues next day</span>}
                    {event.location && <span className="block truncate opacity-80">{event.location}</span>}
                  </button>
                );
              })}
              {nowLine}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sheet on phones, centered card on bigger screens. Tap outside to close. */}
      <dialog
        ref={dialog}
        onClose={() => setSelected(null)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-xl p-0 backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-xl"
      >
        {selected && (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 size-3 shrink-0 rounded-full ${colorOf(selectedCategory?.color).bar}`} aria-hidden />
              <h3 className="flex-1 text-lg font-semibold">{selected.title}</h3>
              <form method="dialog">
                <button type="submit" aria-label="Close" className="-mt-1 rounded px-2 text-2xl leading-none hover:bg-neutral-100">
                  ×
                </button>
              </form>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-neutral-500">When</dt>
              <dd>
                {formatDay(selected.starts_at)}, {formatTime(selected.starts_at)} – {formatDay(selected.starts_at) !== formatDay(selected.ends_at) && `${formatDay(selected.ends_at)}, `}{formatTime(selected.ends_at)}
              </dd>
              {selected.location && (
                <>
                  <dt className="text-neutral-500">Where</dt>
                  <dd>{selected.location}</dd>
                </>
              )}
              {selected.host && (
                <>
                  <dt className="text-neutral-500">Host</dt>
                  <dd>{selected.host}</dd>
                </>
              )}
              <dt className="text-neutral-500">Type</dt>
              <dd>{selectedCategory?.name}</dd>
              {selected.points > 0 && (
                <>
                  <dt className="text-neutral-500">Points</dt>
                  <dd>{selected.points}</dd>
                </>
              )}
            </dl>
            {selected.description && (
              <p className="mt-4 border-t border-neutral-200 pt-4 text-sm whitespace-pre-line">{selected.description}</p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
