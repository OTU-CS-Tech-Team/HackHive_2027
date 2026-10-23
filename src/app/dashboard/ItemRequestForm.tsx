"use client";
/* eslint-disable @next/next/no-img-element -- item photos are small static files */

import { useState, useTransition } from "react";
import { submitItemRequest } from "@/app/actions/itemRequests";
import { MAX_ITEMS, MAX_PENDING_REQUESTS } from "@/lib/itemRequests";

// Placeholders until the real inventory is decided. Give an item an `image` (a path
// under public/, e.g. "/Images/items/arduino-uno.png") to show its photo in its
// box; without one the box shows the item's first letter.
type Preset = { name: string; image?: string };

const PRESETS: Record<"hardware" | "toiletries", Preset[]> = {
  hardware: [
    { name: "Arduino Uno" },
    { name: "Raspberry Pi" },
    { name: "Breadboard" },
    { name: "Jumper wires" },
    { name: "USB-C cable" },
  ],
  toiletries: [
    { name: "Toothbrush" },
    { name: "Toothpaste" },
    { name: "Deodorant" },
    { name: "Shampoo" },
    { name: "Towel" },
  ],
};

type Category = keyof typeof PRESETS | "other";
type OtherItem = { id: string; name: string; quantity: number };

const input = "w-full rounded border border-neutral-300 px-3 py-2";

// Two to a row on a phone so the list isn't one long scroll, then as many as fit.
const grid = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:gap-4";

// On a phone the buttons sit over the picture's left and right edges, so the picture
// can fill the card; from sm up they sit beside it.
const roundButton =
  "absolute z-10 grid size-8 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-lg font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-100 active:scale-90 disabled:pointer-events-none disabled:text-neutral-300 sm:static sm:size-9 sm:shadow-none sm:disabled:opacity-30";

// One rounded card per item, laid out like the sketch: the name on top, the picture
// between the - and + buttons, and the count underneath. Picked items get a dark
// outline. `title` is the name, or the name input for "other" items, and `corner`
// holds anything pinned to the top-right (the remove button).
function ItemCard({
  title,
  name,
  image,
  value,
  onChange,
  canIncrease,
  corner,
}: {
  title: React.ReactNode;
  name: string;
  image?: string;
  value: number;
  onChange: (value: number) => void;
  canIncrease: boolean;
  corner?: React.ReactNode;
}) {
  const label = name.trim() || "of this item";
  return (
    <li
      className={`relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-white p-2.5 shadow-sm transition duration-200 sm:gap-3 sm:p-4 ${
        value > 0 ? "border-neutral-900 shadow-md" : "border-neutral-200 hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      {corner}
      <div className="w-full text-center text-sm font-semibold [overflow-wrap:anywhere]">{title}</div>
      <div className="relative flex w-full items-center justify-between sm:gap-2">
        <button type="button" className={`${roundButton} -left-1`} disabled={value === 0} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
          −
        </button>
        <div className="aspect-square w-full min-w-0 overflow-hidden rounded-xl bg-neutral-100 sm:max-w-24">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-3xl font-bold text-neutral-300" aria-hidden>
              {name.trim()[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        <button type="button" className={`${roundButton} -right-1`} disabled={!canIncrease} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
          +
        </button>
      </div>
      <span
        className={`text-lg font-bold tabular-nums transition-colors ${value > 0 ? "text-neutral-900" : "text-neutral-400"}`}
        aria-live="polite"
      >
        {value}
      </span>
    </li>
  );
}

export function ItemRequestForm({ pendingCount }: { pendingCount: number }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [others, setOthers] = useState<OtherItem[]>([]);
  const [teamMembers, setTeamMembers] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, startTransition] = useTransition();

  const total =
    Object.values(counts).reduce((sum, n) => sum + n, 0) + others.reduce((sum, item) => sum + item.quantity, 0);
  const canAdd = total < MAX_ITEMS;

  const setCount = (name: string, value: number) => setCounts({ ...counts, [name]: value });
  const updateOther = (id: string, change: Partial<OtherItem>) =>
    setOthers(others.map((item) => (item.id === id ? { ...item, ...change } : item)));

  // The shape the item_requests.items column expects.
  const items: { category: Category; name: string; quantity: number }[] = [
    ...(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).flatMap((category) =>
      PRESETS[category]
        .filter(({ name }) => counts[name])
        .map(({ name }) => ({ category, name, quantity: counts[name] })),
    ),
    ...others
      .filter((item) => item.quantity && item.name.trim())
      .map((item) => ({ category: "other" as const, name: item.name.trim(), quantity: item.quantity })),
  ];

  return (
    <>
      <p className="mb-4 text-sm text-neutral-600">
        Need hardware or forgot your toothbrush? Request up to {MAX_ITEMS} items in total per request. You can have up
        to {MAX_PENDING_REQUESTS} requests in the queue at a time
        {pendingCount > 0 && ` (${MAX_PENDING_REQUESTS - pendingCount} more right now)`}.
      </p>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const response = await submitItemRequest({ items, teamMembers, details });
            setResult(response);
            if (response.ok) {
              setCounts({});
              setOthers([]);
              setTeamMembers("");
              setDetails("");
            }
          });
        }}
      >
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((category) => (
          <fieldset key={category} className="rounded-lg border border-neutral-200 p-3 sm:p-5">
            <legend className="px-1 text-lg font-semibold capitalize">{category}</legend>
            <ul className={grid}>
              {PRESETS[category].map(({ name, image }) => (
                <ItemCard
                  key={name}
                  title={name}
                  name={name}
                  image={image}
                  value={counts[name] ?? 0}
                  onChange={(value) => setCount(name, value)}
                  canIncrease={canAdd}
                />
              ))}
            </ul>
          </fieldset>
        ))}

        <fieldset className="rounded-lg border border-neutral-200 p-3 sm:p-5">
          <legend className="px-1 text-lg font-semibold">Other</legend>
          <ul className={grid}>
            {others.map((item) => (
              <ItemCard
                key={item.id}
                title={
                  <input
                    value={item.name}
                    onChange={(event) => updateOther(item.id, { name: event.target.value })}
                    placeholder="What do you need?"
                    aria-label="Item name"
                    className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-center text-sm font-semibold"
                  />
                }
                name={item.name}
                value={item.quantity}
                onChange={(quantity) => updateOther(item.id, { quantity })}
                canIncrease={canAdd}
                corner={
                  <button
                    type="button"
                    onClick={() => setOthers(others.filter((other) => other.id !== item.id))}
                    className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-900"
                    aria-label={`Remove ${item.name || "this item"}`}
                  >
                    ×
                  </button>
                }
              />
            ))}
            <li>
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => setOthers([...others, { id: crypto.randomUUID(), name: "", quantity: 1 }])}
                className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-50"
              >
                <span className="text-4xl leading-none" aria-hidden>
                  +
                </span>
                <span className="text-sm font-medium">Add other item</span>
              </button>
            </li>
          </ul>
        </fieldset>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-medium">Team members</span>
            <textarea
              value={teamMembers}
              onChange={(event) => setTeamMembers(event.target.value)}
              rows={4}
              placeholder={"One name per line"}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Anything else we should know?</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Special needs, allergies, sizes…"
              className={input}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            disabled={items.length === 0 || sending}
            className="rounded bg-neutral-900 px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Submit request"}
          </button>
          <p className={`text-sm ${canAdd ? "text-neutral-600" : "font-medium"}`}>
            {items.length === 0 ? "Pick at least one item to submit." : `${total} / ${MAX_ITEMS} items`}
            {!canAdd && " (limit reached)"}
          </p>
        </div>
        {result && (
          <p role="status" className={`text-sm font-medium ${result.ok ? "text-green-700" : "text-red-700"}`}>
            {result.message}
          </p>
        )}
      </form>
    </>
  );
}
