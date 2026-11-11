"use client";

import { useId } from "react";
import { SelectField } from "./SelectField";

interface SelectWithOtherFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  maxLength: number;
  placeholder?: string;
}

const OTHER = "other";

// A select whose "Other" option opens a box to describe it in their own words.
// The saved value is the option, or what they typed for Other ("other" if blank),
// so an answer that isn't one of the options is read back as Other + that text.
export function SelectWithOtherField({ label, name, value, onChange, options, maxLength, placeholder }: SelectWithOtherFieldProps) {
  const id = useId();
  const listed = options.some((option) => option.value === value);
  const selected = value === "" ? "" : listed ? value : OTHER;
  const custom = listed ? "" : value;

  return (
    <div className="space-y-2">
      <SelectField
        label={label}
        name={name}
        value={selected}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
      />
      {selected === OTHER && (
        <div>
          <label htmlFor={id} className="sr-only">
            {label}: please specify
          </label>
          <input
            id={id}
            type="text"
            value={custom}
            onChange={(e) => onChange(e.target.value.trim() ? e.target.value : OTHER)}
            maxLength={maxLength}
            placeholder="Please specify (optional)"
            className="block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
