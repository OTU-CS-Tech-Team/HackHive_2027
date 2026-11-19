"use client";

import { useId } from "react";
import { SelectField } from "./SelectField";
import { inputClass } from "./styles";

interface SelectWithOtherFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

const OTHER = "other";

// A select whose "Other" option opens a box to describe it in their own words.
// The saved value is the option, or what they typed for Other ("other" if blank),
// so an answer that isn't one of the options is read back as Other + that text.
export function SelectWithOtherField({ label, name, value, onChange, options, maxLength, placeholder, required, error }: SelectWithOtherFieldProps) {
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
        required={required}
        error={error}
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
            className={inputClass()}
          />
        </div>
      )}
    </div>
  );
}
