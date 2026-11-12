"use client";

import { createContext, useContext, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "./actions";

// Checkboxes, a select-all bar, and one confirm dialog for a list of deletable rows.
// The rows stay wherever they're rendered (server or client); SelectBox and
// DeleteButton find the list through context.

type Item = { id: string; label: string };

type SelectionApi = {
  selected: Set<string>;
  toggle: (id: string, range: boolean) => void;
  ask: (ids: string[]) => void;
  pending: boolean;
};

const SelectionContext = createContext<SelectionApi | null>(null);

function useSelection() {
  const api = useContext(SelectionContext);
  if (!api) throw new Error("SelectBox and DeleteButton go inside <Selection>");
  return api;
}

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const MAX_LISTED = 8;

export function Selection({
  items,
  onDelete,
  warning = "This can't be undone.",
  children,
}: {
  items: Item[];
  onDelete: (ids: string[]) => Promise<ActionResult>;
  warning?: string;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<string[]>([]);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const lastClicked = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  // Rows that were deleted drop out on their own; ones that failed stay selected.
  const labels = new Map(items.map((item) => [item.id, item.label]));
  const selected = new Set([...picked].filter((id) => labels.has(id)));
  const all = items.length > 0 && selected.size === items.length;

  // Shift-click selects everything between the last box clicked and this one.
  const toggle = (id: string, range: boolean) => {
    const on = !selected.has(id);
    const ids = items.map((item) => item.id);
    const from = range && lastClicked.current ? ids.indexOf(lastClicked.current) : -1;
    const to = ids.indexOf(id);
    const span = from >= 0 ? ids.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    lastClicked.current = id;
    setPicked(() => {
      const next = new Set(selected);
      for (const each of span) {
        if (on) next.add(each);
        else next.delete(each);
      }
      return next;
    });
  };

  const ask = (ids: string[]) => {
    if (!ids.length || pending) return;
    flushSync(() => setAsking(ids));
    dialog.current!.returnValue = "";
    dialog.current!.showModal();
  };

  const run = (ids: string[]) =>
    startTransition(async () => {
      setNotice(null);
      try {
        setNotice(await onDelete(ids));
      } catch {
        setNotice({ ok: false, message: "That didn't go through. Refresh the page and try again." });
      }
    });

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  };

  return (
    <SelectionContext.Provider value={{ selected, toggle, ask, pending }}>
      {items.length > 0 && (
        <div className="sticky top-16 z-20 -mx-2 mb-2 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/95 px-2 py-1 backdrop-blur md:top-0">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 pr-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={all}
              ref={(box) => {
                if (box) box.indeterminate = selected.size > 0 && !all;
              }}
              onChange={() => setPicked(all ? new Set() : new Set(items.map((item) => item.id)))}
              className="size-4 accent-neutral-900"
            />
            {selected.size ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              <button type="button" onClick={() => setPicked(new Set())} className={`min-h-11 rounded-md px-2 text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900 ${ring}`}>
                Clear
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => ask([...selected])}
                className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 ${ring}`}
              >
                <Trash2 className="size-4" aria-hidden />
                {pending ? "Deleting…" : `Delete ${selected.size}`}
              </button>
            </>
          )}
          <p role="status" className="basis-full text-sm empty:hidden">
            {notice && <span className={notice.ok ? "text-green-800" : "text-red-700"}>{notice.message}</span>}
          </p>
        </div>
      )}

      {children}

      {/* Cancel comes first, so it has focus and Enter backs out. */}
      <dialog
        ref={dialog}
        onClick={closeOnBackdrop}
        onClose={() => dialog.current?.returnValue === "delete" && run(asking)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-neutral-950/40"
      >
        <form method="dialog" className="flex flex-col gap-3 p-6">
          <h2 className="text-lg font-semibold break-words">
            {asking.length === 1 ? `Delete “${labels.get(asking[0])}”?` : `Delete these ${asking.length}?`}
          </h2>
          {asking.length > 1 && (
            <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm break-words text-neutral-700">
              {asking.slice(0, MAX_LISTED).map((id) => (
                <li key={id}>{labels.get(id)}</li>
              ))}
              {asking.length > MAX_LISTED && <li className="list-none text-neutral-500">and {asking.length - MAX_LISTED} more</li>}
            </ul>
          )}
          <p className="text-sm text-neutral-600">{warning}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button value="cancel" className={`min-h-11 rounded-md border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-100 ${ring}`}>
              Cancel
            </button>
            <button value="delete" className={`min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 ${ring}`}>
              Delete{asking.length > 1 ? ` ${asking.length}` : ""}
            </button>
          </div>
        </form>
      </dialog>
    </SelectionContext.Provider>
  );
}

export function SelectBox({ id, label }: Item) {
  const { selected, toggle } = useSelection();
  return (
    <label className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        data-select
        aria-label={`Select ${label}`}
        checked={selected.has(id)}
        // onClick, not onChange, because only the click knows about Shift.
        onClick={(event) => toggle(id, event.shiftKey)}
        onChange={() => {}}
        className="size-4 accent-neutral-900"
      />
    </label>
  );
}

export function DeleteButton({ id, label }: Item) {
  const { ask, pending } = useSelection();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => ask([id])}
      aria-label={`Delete ${label}`}
      title="Delete"
      className={`flex size-11 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 ${ring}`}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
