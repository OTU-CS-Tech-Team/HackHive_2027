"use client";

import { useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import type { HackEvent } from "@/lib/content";
import { formatDateTime, formatTime, toLocalInput } from "@/lib/time";
import { CATEGORIES } from "@/components/sections/Schedule";
import { deleteEvent, saveEvent } from "./actions";

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";

// Times are typed as Toronto time, whatever timezone the admin's laptop is in.
function EventFields({ event }: { event?: HackEvent }) {
  return (
    <>
      {event && <input type="hidden" name="id" value={event.id} />}
      <label>
        Title
        <input name="title" required defaultValue={event?.title} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Category
          <select name="category" required defaultValue={event?.category ?? ""} className={input}>
            <option value="" disabled>
              Pick one
            </option>
            {Object.entries(CATEGORIES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Check-in points (0 = no check-in)
          <input name="points" type="number" min={0} step={1} defaultValue={event?.points ?? 0} className={input} />
        </label>
        <label>
          Starts (Eastern)
          <input name="starts_at" type="datetime-local" required defaultValue={event && toLocalInput(event.starts_at)} className={input} />
        </label>
        <label>
          Ends (Eastern)
          <input name="ends_at" type="datetime-local" required defaultValue={event && toLocalInput(event.ends_at)} className={input} />
        </label>
        <label>
          Location
          <input name="location" defaultValue={event?.location ?? ""} className={input} />
        </label>
        <label>
          Hosted by
          <input name="host" defaultValue={event?.host ?? ""} placeholder="e.g. a sponsor" className={input} />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows={3} defaultValue={event?.description ?? ""} className={input} />
      </label>
    </>
  );
}

function DeleteButton({ event }: { event: HackEvent }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-red-700 underline disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Delete "${event.title}"? Points already awarded for it stay.`)) return;
        startTransition(async () => {
          const message = await deleteEvent(event.id);
          if (message !== "Deleted.") alert(message);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function EventsAdmin({ events }: { events: HackEvent[] }) {
  return (
    <div id="events" className="flex scroll-mt-20 flex-col gap-6">
      <section className={card}>
        <h2 className="mb-4 text-lg font-semibold">Add an event</h2>
        <ActionForm action={saveEvent} submitLabel="Add event">
          <EventFields />
        </ActionForm>
      </section>

      <section className={card}>
        <h2 className="mb-4 text-lg font-semibold">Schedule ({events.length})</h2>
        {events.length === 0 && <p className="text-neutral-600">No events yet.</p>}
        <ol className="flex flex-col divide-y">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{event.title}</p>
                <span className="text-sm text-neutral-600">
                  {formatDateTime(event.starts_at)} – {formatTime(event.ends_at)}
                </span>
              </div>
              <p className="text-sm text-neutral-600">
                {CATEGORIES[event.category].label}
                {event.location && ` · ${event.location}`}
                {event.points > 0 && ` · ${event.points} pts`}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm underline">Edit</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <ActionForm action={saveEvent} submitLabel="Save changes">
                    <EventFields event={event} />
                  </ActionForm>
                  <DeleteButton event={event} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
