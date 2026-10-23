"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitItemRequest } from "@/app/actions/itemRequests";
import { MAX_ITEMS } from "@/lib/itemRequests";

// Placeholders until the real inventory is decided.
const PRESETS = {
  hardware: ["Arduino Uno", "Raspberry Pi", "Breadboard", "Jumper wires", "USB-C cable"],
  toiletries: ["Toothbrush", "Toothpaste", "Deodorant", "Shampoo", "Towel"],
};

type Category = keyof typeof PRESETS | "other";
type OtherItem = { id: string; name: string; quantity: number };

const input = "w-full rounded border border-neutral-300 px-3 py-2";

function Counter({
  value,
  onChange,
  canIncrease,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  canIncrease: boolean;
  label: string;
}) {
  const button = "h-8 w-8 rounded border border-neutral-300 font-semibold disabled:opacity-30";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={button} disabled={value === 0} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span className="w-4 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} disabled={!canIncrease} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}

export function ItemRequestSection() {
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
        .filter((name) => counts[name])
        .map((name) => ({ category, name, quantity: counts[name] })),
    ),
    ...others
      .filter((item) => item.quantity && item.name.trim())
      .map((item) => ({ category: "other" as const, name: item.name.trim(), quantity: item.quantity })),
  ];

  return (
    <section id="item-request" aria-label="Item request" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold">Request items</h2>
        <p className="text-neutral-600">
          Need hardware or forgot your toothbrush? Request up to {MAX_ITEMS} items in total.
        </p>
      </div>

      <form
        className="flex flex-col gap-8"
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

        <div className="grid gap-6 md:grid-cols-2">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((category) => (
            <fieldset key={category} className="rounded-lg border border-neutral-200 p-5">
              <legend className="px-1 text-lg font-semibold capitalize">{category}</legend>
              <ul className="flex flex-col gap-3">
                {PRESETS[category].map((name) => {
                  const count = counts[name] ?? 0;
                  return (
                    <li key={name} className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={count > 0}
                          disabled={!count && !canAdd}
                          onChange={() => setCount(name, count ? 0 : 1)}
                        />
                        {name}
                      </label>
                      <Counter value={count} onChange={(value) => setCount(name, value)} canIncrease={canAdd} label={name} />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>

        <fieldset className="rounded-lg border border-neutral-200 p-5">
          <legend className="px-1 text-lg font-semibold">Other</legend>
          <ul className="mb-4 flex flex-col gap-3">
            {others.map((item) => (
              <li key={item.id} className="flex items-center gap-4">
                <input
                  value={item.name}
                  onChange={(event) => updateOther(item.id, { name: event.target.value })}
                  placeholder="What do you need?"
                  aria-label="Item name"
                  className={input}
                />
                <Counter
                  value={item.quantity}
                  onChange={(quantity) => updateOther(item.id, { quantity })}
                  canIncrease={canAdd}
                  label={item.name || "of this item"}
                />
                <button
                  type="button"
                  onClick={() => setOthers(others.filter((other) => other.id !== item.id))}
                  className="text-sm text-neutral-500 underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => setOthers([...others, { id: crypto.randomUUID(), name: "", quantity: 1 }])}
            className="rounded border border-neutral-300 px-4 py-2 disabled:opacity-50"
          >
            + Add other item
          </button>
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
            {result.message === "Log in to request items." && (
              <>
                {" "}
                <Link href="/auth/login" className="underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        )}
      </form>
    </section>
  );
}
