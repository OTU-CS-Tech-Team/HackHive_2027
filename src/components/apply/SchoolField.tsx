"use client";

import { useEffect, useId, useState } from "react";
import { errorClass, hintClass, inputClass, labelClass, linkClass } from "./styles";

interface SchoolFieldProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: string;
}

const NOT_LISTED = "Other";
const DEBOUNCE_MS = 150;

type Lookup = { query: string; schools: string[]; failed: boolean };

/**
 * Asks /api/schools about `text`, debounced. MLH's school list is too big to
 * send to the browser, so the search runs on the server. A newer query aborts
 * the older request, so a slow, stale answer can never replace a newer one.
 * While a query is in flight the last answer stays on screen, with `loading` set.
 */
function useSchoolLookup(text: string, mode: "search" | "exact", enabled: boolean) {
  const [data, setData] = useState<Lookup>({ query: "", schools: [], failed: false });
  const query = text.trim();
  const active = enabled && query !== "";

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams(mode === "exact" ? { q: query, mode } : { q: query });
      try {
        const res = await fetch(`/api/schools?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`School search failed: ${res.status}`);
        const body: unknown = await res.json();
        const list = (body as { schools?: unknown })?.schools;
        const schools = Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
        if (!controller.signal.aborted) setData({ query, schools, failed: false });
      } catch {
        if (!controller.signal.aborted) setData({ query, schools: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, query, mode]);

  return {
    schools: active ? data.schools : [],
    loading: active && data.query !== query,
    failed: active && data.query === query && data.failed,
  };
}

// A search box over MLH's school list. Picking a school saves its exact name;
// "Other" swaps in a free-text box. Typing without picking
// leaves the value empty, so the form asks them to choose.
export function SchoolField({ value, onChange, maxLength, error }: SchoolFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Always start on the search. Free text only opens when they pick "Other";
  // an older draft's typed school is put in the search box so they can pick it.
  const [isOther, setIsOther] = useState(false);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focusOther, setFocusOther] = useState(false);

  // The value can also change from outside (a saved draft restored after mount).
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== "" && !isOther) setQuery(value);
  }

  const results = useSchoolLookup(query, "search", open && !isOther);
  // "Did you mean": what they typed under "Other" is exactly a listed school or alias.
  const suggestion = useSchoolLookup(value, "exact", isOther).schools[0];

  const options = [...results.schools, NOT_LISTED];
  const showList = open && query.trim() !== "";
  // Results can shrink when an answer arrives; keep the highlight on a real option.
  const activeIndex = Math.min(active, options.length - 1);
  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(" ");

  const choose = (option: string) => {
    setOpen(false);
    setActive(-1);
    if (option === NOT_LISTED) {
      setIsOther(true);
      setFocusOther(true);
      onChange("");
      return;
    }
    setQuery(option);
    onChange(option);
  };

  const backToList = (school = "") => {
    setIsOther(false);
    setQuery(school);
    onChange(school);
  };

  const label = (htmlFor: string) => (
    <label htmlFor={htmlFor} className={labelClass}>
      School
    </label>
  );

  const errorText = error && (
    <p id={errorId} className={errorClass} role="alert">
      {error}
    </p>
  );

  if (isOther) {
    return (
      <div className="space-y-2">
        {label(id)}
        <input
          id={id}
          name="university"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Left empty, the box gives way to the school search again.
          onBlur={() => {
            if (!value.trim()) backToList();
          }}
          maxLength={maxLength}
          autoComplete="organization"
          autoFocus={focusOther}
          placeholder="Your school's name"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className={inputClass(error)}
        />
        {suggestion && (
          <p className={hintClass}>
            Did you mean{" "}
            <button
              type="button"
              onClick={() => backToList(suggestion)}
              className={linkClass}
            >
              {suggestion}
            </button>
            ?
          </p>
        )}
        {errorText}
      </div>
    );
  }

  const status = results.loading && results.schools.length === 0
    ? "Searching…"
    : results.failed
      ? "Couldn't search schools right now. Try again, or pick Other to type it."
      : null;

  return (
    <div className="space-y-2">
      {label(id)}
      <p id={hintId} className={hintClass}>
        Start typing to search, e.g. &ldquo;UofT&rdquo; or &ldquo;Waterloo&rdquo;
      </p>
      <div className="relative">
        <input
          id={id}
          name="university"
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim() ? 0 : -1);
            if (value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive(Math.min(activeIndex + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(activeIndex - 1, 0));
            } else if (e.key === "Enter" && showList && activeIndex >= 0) {
              e.preventDefault();
              // Don't pick from an answer to an older query; the fresh one is a moment away.
              if (!results.loading) choose(options[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          maxLength={maxLength}
          autoComplete="off"
          placeholder="Search for your school"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={inputClass(error)}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Schools"
            aria-busy={results.loading || undefined}
            className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-hive-line bg-white p-1 shadow-[0_12px_32px_-8px_rgba(19,47,64,0.18)]"
          >
            {status && (
              <li role="presentation" className="px-3 py-2 text-sm text-hive-muted">
                {status}
              </li>
            )}
            {options.map((option, i) => (
              <li
                key={i === options.length - 1 ? `${listId}-other` : option}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                // mousedown, not click: picking must happen before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === activeIndex ? "bg-hive-honey-soft" : ""} ${
                  i === options.length - 1 ? "text-hive-muted" : "font-medium text-hive-ink"
                }`}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorText}
    </div>
  );
}
