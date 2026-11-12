"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import type { EventCategory, HackEvent } from "@/lib/content";
import { colorOf } from "@/lib/schedule";
import { formatDateTime, formatTime, toLocalInput } from "@/lib/time";
import { deleteEvents, saveEvent } from "./actions";
import { DeleteButton, SelectBox, Selection } from "./Selection";

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

export function EventsAdmin({ events, categories }: { events: HackEvent[]; categories: EventCategory[] }) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return (
    <>
      <details className="group mb-6 rounded-lg border border-neutral-200 bg-neutral-50/60 open:bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-medium [&::-webkit-details-marker]:hidden">
          <Plus className="size-4 transition-transform group-open:rotate-45" aria-hidden />
          Add event
        </summary>
        <div className="border-t border-neutral-200 p-4">
          <p className="mb-4 text-sm text-neutral-600">
            Need a new kind of event (e.g. Networking) or a different colour? Add or edit it under{" "}
            <Link href="/admin/event_categories" className="underline">
              Schedule categories
            </Link>
            .
          </p>
          <ActionForm action={saveEvent} submitLabel="Add event">
            <EventFields categories={categories} />
          </ActionForm>
        </div>
      </details>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-neutral-600">No events yet.</p>
      ) : (
        <Selection
          items={events.map((event) => ({ id: event.id, label: event.title }))}
          onDelete={deleteEvents}
          warning="Points already awarded for them stay. This can't be undone."
        >
          <ol className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 px-3 py-2 has-[[data-select]:checked]:bg-amber-50/60">
                <SelectBox id={event.id} label={event.title} />
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold break-words">{event.title}</p>
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
                  <details className="mt-1">
                    <summary className="inline-flex min-h-9 cursor-pointer items-center text-sm underline underline-offset-2">Edit</summary>
                    <div className="mt-2 mb-2">
                      <ActionForm action={saveEvent} submitLabel="Save changes">
                        <EventFields event={event} categories={categories} />
                      </ActionForm>
                    </div>
                  </details>
                </div>
                <DeleteButton id={event.id} label={event.title} />
              </li>
            ))}
          </ol>
        </Selection>
      )}
    </>
  );
}
