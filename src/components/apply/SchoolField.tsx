"use client";

import { useId, useMemo, useState } from "react";
import { exactSchoolMatches, searchSchools } from "@/lib/schools";
import { errorClass, hintClass, inputClass, labelClass, linkClass } from "./styles";

interface SchoolFieldProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: string;
}

const NOT_LISTED = "Other";

// A search box over the school list. Picking a school saves its exact name;
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

  const results = useMemo(() => searchSchools(query), [query]);
  const options = [...results.map((school) => school.name), NOT_LISTED];
  const showList = open && query.trim() !== "";
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
    const suggestion = exactSchoolMatches(value)[0];
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
              onClick={() => backToList(suggestion.name)}
              className={linkClass}
            >
              {suggestion.name}
            </button>
            ?
          </p>
        )}
        {errorText}
      </div>
    );
  }

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
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && showList && active >= 0) {
              e.preventDefault();
              choose(options[active]);
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
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={inputClass(error)}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Schools"
            className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-hive-line bg-white p-1 shadow-[0_12px_32px_-8px_rgba(19,47,64,0.18)]"
          >
            {options.map((option, i) => (
              <li
                key={option}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: picking must happen before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === active ? "bg-hive-honey-soft" : ""} ${
                  option === NOT_LISTED ? "text-hive-muted" : "font-medium text-hive-ink"
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
