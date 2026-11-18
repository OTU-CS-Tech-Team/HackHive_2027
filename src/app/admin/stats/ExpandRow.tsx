import { useState } from "react";
export const number = (value: number) => value.toLocaleString("en-US");
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4,7 10,13 16,7" />
    </svg>
  );
}

export function StatRow({
  label,
  count =null,
  details = [],
}: {
  label: string;
  count: number | null;
  details?: string[];
}) {
  const [open, setOpen] = useState(false);
  const expandable = details.length > 0;

  return (
    <div className="py-2 text-sm">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!expandable}
        className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2 text-neutral-600">
          {expandable && <Chevron open={open} />}
          {label}
        </span>
        <span className="font-semibold tabular-nums">
    {count == null ? "" : number(count)}
  </span>
      </button>

      {open && (
        <ul className="mt-2 ml-6 list-disc space-y-1 text-neutral-500">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}