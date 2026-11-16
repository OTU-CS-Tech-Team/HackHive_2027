"use client";

import { useId, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { errorClass, hintClass, inputClass, labelClass } from "./styles";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// HackHive runs in 2027, so nobody coming has graduated before then.
// 2027–2038 is exactly one page of 12 in the year view.
export const MIN_YEAR = 2027;
const MAX_YEAR = 2038;
const PAGE = 12;

// "2028-04-01" -> [2028, 3]. Older drafts may hold any day of the month.
function parse(value: string): [number, number] | null {
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? [Number(match[1]), Number(match[2]) - 1] : null;
}

const clampYear = (year: number) => Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));

// Graduation only needs a month, so this picks one and stores the 1st ("2028-04-01"),
// which still fits the date column and shows as "April 2028" everywhere else.
// Clicking the year switches the grid to 12 years at a time.
export function MonthPicker({
  label,
  name,
  value,
  onChange,
  description,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  error?: string;
}) {
  const id = useId();
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const [year, setYear] = useState(selected?.[0] ?? MIN_YEAR);

  const pageStart = MIN_YEAR + Math.floor((year - MIN_YEAR) / PAGE) * PAGE;
  const years = Array.from({ length: PAGE }, (_, i) => pageStart + i).filter((y) => y <= MAX_YEAR);
  const step = view === "months" ? 1 : PAGE;
  const canGoBack = view === "months" ? year > MIN_YEAR : pageStart > MIN_YEAR;
  const canGoForward = view === "months" ? year < MAX_YEAR : pageStart + PAGE <= MAX_YEAR;
  // Every year already fits on one page, so the year view needs no arrows.
  const hideArrows = view === "years" && !canGoBack && !canGoForward;

  const describedBy = [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const arrow =
    "flex size-9 items-center justify-center rounded-lg text-hive-muted transition-colors hover:bg-hive-field hover:text-hive-ink disabled:pointer-events-none disabled:opacity-30";
  const cell = (isSelected: boolean, isViewed = false) =>
    `h-10 rounded-[10px] text-sm font-semibold transition-colors outline-offset-2 ${
      isSelected
        ? "bg-hive-honey text-hive-ink"
        : isViewed
          ? "bg-hive-honey-soft text-hive-ink"
          : "text-hive-ink/80 hover:bg-hive-honey-soft hover:text-hive-ink"
    }`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {description && (
        <p id={`${id}-description`} className={hintClass}>
          {description}
        </p>
      )}
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          // Open on their month, or on this year when nothing is picked yet.
          if (next) {
            setYear(clampYear(selected?.[0] ?? new Date().getFullYear()));
            setView("months");
          }
          setOpen(next);
        }}
      >
        <Popover.Trigger
          id={id}
          name={name}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`${inputClass(error)} flex items-center justify-between gap-3 text-left`}
        >
          {selected ? (
            `${MONTH_NAMES[selected[1]]} ${selected[0]}`
          ) : (
            <span className="font-normal text-hive-placeholder">Pick a month</span>
          )}
          <CalendarDays className="size-4 shrink-0 text-hive-muted" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
            <Popover.Popup
              aria-label={`${label}: choose a month`}
              className="w-72 origin-[var(--transform-origin)] rounded-2xl border border-hive-line bg-white p-3 shadow-[0_12px_32px_rgba(19,47,64,0.14)] outline-none transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 motion-reduce:transition-opacity"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setYear(clampYear(year - step))}
                  disabled={!canGoBack}
                  aria-label={view === "months" ? "Previous year" : "Previous 12 years"}
                  className={`${arrow} ${hideArrows ? "invisible" : ""}`}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setView(view === "months" ? "years" : "months")}
                  aria-label={view === "months" ? `${year}, choose a year` : "Back to months"}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-display text-base font-bold text-hive-ink transition-colors hover:bg-hive-field"
                >
                  <span aria-live="polite">{view === "months" ? year : `${years[0]} – ${years[years.length - 1]}`}</span>
                  <ChevronDown
                    className={`size-4 text-hive-muted transition-transform duration-150 ${view === "years" ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setYear(clampYear(year + step))}
                  disabled={!canGoForward}
                  aria-label={view === "months" ? "Next year" : "Next 12 years"}
                  className={`${arrow} ${hideArrows ? "invisible" : ""}`}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {view === "months"
                  ? MONTHS.map((month, index) => (
                      <button
                        key={month}
                        type="button"
                        aria-pressed={selected?.[0] === year && selected[1] === index}
                        aria-label={`${MONTH_NAMES[index]} ${year}`}
                        onClick={() => {
                          onChange(`${year}-${String(index + 1).padStart(2, "0")}-01`);
                          setOpen(false);
                        }}
                        className={cell(selected?.[0] === year && selected[1] === index)}
                      >
                        {month}
                      </button>
                    ))
                  : years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={selected?.[0] === y}
                        onClick={() => {
                          setYear(y);
                          setView("months");
                        }}
                        className={cell(selected?.[0] === y, y === year)}
                      >
                        {y}
                      </button>
                    ))}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {error && (
        <p id={`${id}-error`} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
