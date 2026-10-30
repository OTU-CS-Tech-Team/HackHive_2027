"use client";

import { useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import type { EventCategory, HackEvent } from "@/lib/content";
import { colorOf } from "@/lib/schedule";
import { formatDateTime, formatTime, toLocalInput } from "@/lib/time";
import { deleteEvent, saveEvent } from "./actions";

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";

// Times are typed as Toronto time, whatever timezone the admin's laptop is in.
function EventFields({ event, categories }: { event?: HackEvent; categories: EventCategory[] }) {
  return (
    <>
      {event && <input type="hidden" name="id" value={event.id} />}
      <label>
        Title
        <input name="title" required defaultValue={event?.title} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Category (sets the colour and column)
          <select name="category_id" required defaultValue={event?.category_id ?? ""} className={input}>
            <option value="" disabled>
              Pick one
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
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

export function EventsAdmin({ events, categories }: { events: HackEvent[]; categories: EventCategory[] }) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return (
    <div id="events" className="flex scroll-mt-20 flex-col gap-6">
      <section className={card}>
        <h2 className="mb-1 text-lg font-semibold">Add an event</h2>
        <p className="mb-4 text-sm text-neutral-600">
          Need a new kind of event (e.g. Networking) or a different colour? Add or edit it under{" "}
          <a href="#event_categories" className="underline">
            Schedule categories
          </a>
          .
        </p>
        <ActionForm action={saveEvent} submitLabel="Add event">
          <EventFields categories={categories} />
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
              <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                <span className={`size-2.5 shrink-0 rounded-full ${colorOf(byId.get(event.category_id)?.color).bar}`} aria-hidden />
                {byId.get(event.category_id)?.name}
                {event.location && ` · ${event.location}`}
                {event.points > 0 && ` · ${event.points} pts`}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm underline">Edit</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <ActionForm action={saveEvent} submitLabel="Save changes">
                    <EventFields event={event} categories={categories} />
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
