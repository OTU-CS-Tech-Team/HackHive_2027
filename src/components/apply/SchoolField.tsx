"use client";

import { useId, useMemo, useState } from "react";
import { exactSchoolMatches, searchSchools } from "@/lib/schools";

interface SchoolFieldProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: string;
}

const NOT_LISTED = "Other";

const inputClass = (error?: string) =>
  `mt-1 block w-full rounded-lg border px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 ${
    error
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900"
  }`;

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
    <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
      School Name
      <span className="ml-1 text-red-500" aria-hidden="true">*</span>
    </label>
  );

  const errorText = error && (
    <p id={errorId} className="text-sm text-red-600" role="alert">
      {error}
    </p>
  );

  if (isOther) {
    const suggestion = exactSchoolMatches(value)[0];
    return (
      <div className="space-y-1">
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
          <p className="text-sm text-neutral-600">
            Did you mean{" "}
            <button
              type="button"
              onClick={() => backToList(suggestion.name)}
              className="font-medium text-neutral-900 underline hover:no-underline"
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
    <div className="space-y-1">
      {label(id)}
      <p id={hintId} className="text-sm text-neutral-500">
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
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
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
                className={`cursor-pointer px-4 py-2 text-sm ${i === active ? "bg-neutral-100" : ""} ${
                  option === NOT_LISTED ? "border-t border-neutral-100 text-neutral-600 italic" : "text-neutral-900"
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
