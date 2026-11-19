"use client";
/* eslint-disable @next/next/no-img-element -- item photos are small static files */

import { useState, useTransition } from "react";
import { submitItemRequest } from "@/app/actions/itemRequests";
import { HARDWARE_GROUPS, hardwareImage, MAX_ITEMS, MAX_PENDING_REQUESTS } from "@/lib/itemRequests";

// Hardware comes from HARDWARE_GROUPS and is one of each, so it's picked rather than
// counted. Toiletries are placeholders until the real list is decided. Give one an
// `image` (a path under public/, e.g. "/Images/items/toothbrush.png") to show its
// photo in its box; without one the box shows the item's first letter.
type Preset = { name: string; image?: string };

const PRESETS: Record<"toiletries", Preset[]> = {
  toiletries: [
    { name: "Toothbrush" },
    { name: "Toothpaste" },
    { name: "Deodorant" },
    { name: "Shampoo" },
    { name: "Towel" },
  ],
};

type Category = "hardware" | keyof typeof PRESETS | "other";
type OtherItem = { id: string; name: string; quantity: number };

// The same focus ring, inputs and buttons as the rest of the dashboard and admin.
const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const input = `w-full rounded-md border border-neutral-300 bg-white px-3 py-2 ${ring}`;

// Two to a row on a phone so the list isn't one long scroll, then as many as fit.
const grid = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:gap-4";

// On a phone the buttons sit over the picture's left and right edges, so the picture
// can fill the card; from sm up they sit beside it.
const roundButton = `absolute z-10 grid size-9 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-lg font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-100 active:scale-90 disabled:pointer-events-none disabled:text-neutral-300 sm:static sm:shadow-none sm:disabled:opacity-30 ${ring}`;

// One card per item: the name on top, the picture between the - and + buttons, and
// the count underneath. Picked items turn amber, like the selected tab in the
// sidebar. `title` is the name, or the name input for "other" items, and `corner`
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
      className={`relative flex min-w-0 flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors sm:gap-3 sm:p-4 ${
        value > 0 ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      {corner}
      <div className="w-full text-center text-sm font-semibold [overflow-wrap:anywhere]">{title}</div>
      <div className="relative flex w-full items-center justify-between sm:gap-2">
        <button type="button" className={`${roundButton} -left-1`} disabled={value === 0} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
          −
        </button>
        <div className="aspect-square w-full min-w-0 overflow-hidden rounded-md bg-neutral-100 sm:max-w-24">
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
        className={`text-lg font-bold tabular-nums transition-colors ${value > 0 ? "text-amber-900" : "text-neutral-400"}`}
        aria-live="polite"
      >
        {value}
      </span>
    </li>
  );
}

// A hardware item: tap to pick it, tap again to drop it. Items already waiting in
// another of the hacker's requests are shown but can't be picked.
function HardwareTile({
  name,
  picked,
  requested,
  disabled,
  onToggle,
}: {
  name: string;
  picked: boolean;
  requested: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={picked}
        disabled={requested || disabled}
        onClick={onToggle}
        className={`group relative flex h-full w-full flex-col items-center gap-2 rounded-lg border p-2.5 text-center text-sm transition-colors disabled:cursor-not-allowed sm:p-3 ${ring} ${
          picked
            ? "border-amber-300 bg-amber-50 font-medium text-amber-900"
            : "border-neutral-200 bg-white hover:border-neutral-300 disabled:bg-neutral-50 disabled:text-neutral-400 disabled:hover:border-neutral-200"
        }`}
      >
        <span
          className={`absolute top-2 right-2 z-10 grid size-5 place-items-center rounded border text-xs font-bold ${picked ? "border-amber-500 bg-amber-500 text-white" : "border-neutral-300 bg-white"}`}
          aria-hidden
        >
          {picked && "✓"}
        </span>
        {/* White behind the photo, since MLH's photos are on white. */}
        <span className="block aspect-square w-full overflow-hidden rounded-md bg-white">
          <img
            src={hardwareImage(name)}
            alt=""
            loading="lazy"
            className={`h-full w-full object-contain p-1 ${requested ? "opacity-40 grayscale" : ""}`}
          />
        </span>
        <span className="[overflow-wrap:anywhere]">{name}</span>
        {requested && <span className="text-xs text-neutral-500">Requested</span>}
      </button>
    </li>
  );
}

export function ItemRequestForm({ pendingCount, requestedHardware }: { pendingCount: number; requestedHardware: string[] }) {
  const [hardware, setHardware] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [others, setOthers] = useState<OtherItem[]>([]);
  const [teamMembers, setTeamMembers] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, startTransition] = useTransition();

  const total =
    hardware.size + Object.values(counts).reduce((sum, n) => sum + n, 0) + others.reduce((sum, item) => sum + item.quantity, 0);
  const canAdd = total < MAX_ITEMS;
  const alreadyRequested = new Set(requestedHardware);

  const toggleHardware = (name: string) => {
    const next = new Set(hardware);
    if (!next.delete(name)) next.add(name);
    setHardware(next);
  };
  const setCount = (name: string, value: number) => setCounts({ ...counts, [name]: value });
  const updateOther = (id: string, change: Partial<OtherItem>) =>
    setOthers(others.map((item) => (item.id === id ? { ...item, ...change } : item)));

  // The shape the item_requests.items column expects.
  const items: { category: Category; name: string; quantity: number }[] = [
    ...HARDWARE_GROUPS.flatMap((group) => group.items)
      .filter((name) => hardware.has(name))
      .map((name) => ({ category: "hardware" as const, name, quantity: 1 })),
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
        Up to {MAX_ITEMS} items per request, and up to {MAX_PENDING_REQUESTS} requests waiting at a time
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
              setHardware(new Set());
              setCounts({});
              setOthers([]);
              setTeamMembers("");
              setDetails("");
            }
          });
        }}
      >
        <fieldset className="rounded-lg border border-neutral-200 p-3 sm:p-5">
          <legend className="px-1 font-semibold">Hardware</legend>
          <p className="mb-4 text-sm text-neutral-600">One of each item. Tap to pick it, tap again to remove it.</p>
          <div className="flex flex-col gap-5">
            {HARDWARE_GROUPS.map((group) => (
              <div key={group.name}>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{group.name}</h4>
                <ul className={grid}>
                  {group.items.map((name) => (
                    <HardwareTile
                      key={name}
                      name={name}
                      picked={hardware.has(name)}
                      requested={alreadyRequested.has(name)}
                      disabled={!hardware.has(name) && !canAdd}
                      onToggle={() => toggleHardware(name)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>

        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((category) => (
          <fieldset key={category} className="rounded-lg border border-neutral-200 p-3 sm:p-5">
            <legend className="px-1 font-semibold capitalize">{category}</legend>
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
          <legend className="px-1 font-semibold">Other</legend>
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
                    className={`w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-center text-sm font-semibold ${ring}`}
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
                    className={`absolute -right-2 -top-2 z-10 grid size-8 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:bg-red-50 hover:text-red-700 ${ring}`}
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
                className={`flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${ring}`}
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={items.length === 0 || sending}
            className={`inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${ring}`}
          >
            {sending ? "Sending…" : "Submit request"}
          </button>
          <p className={`text-sm tabular-nums ${canAdd ? "text-neutral-600" : "font-medium text-amber-900"}`}>
            {items.length === 0 ? "Pick at least one item to submit." : `${total} / ${MAX_ITEMS} items`}
            {!canAdd && " (limit reached)"}
          </p>
        </div>
        <div role="status" className="empty:hidden">
          {result && (
            <p
              className={`rounded-md border px-4 py-2 text-sm ${result.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
            >
              {result.message}
            </p>
          )}
        </div>
      </form>
    </>
  );
}
