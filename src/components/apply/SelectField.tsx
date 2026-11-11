"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { errorClass, hintClass, inputClass, labelClass, Optional } from "./styles";

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[] | readonly string[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  placeholder?: string;
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  description,
  placeholder = "Select an option",
}: SelectFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {!required && <Optional />}
      </label>
      {description && (
        <p id={descriptionId} className={hintClass}>
          {description}
        </p>
      )}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`${inputClass(error)} appearance-none pr-11 ${value ? "" : "text-hive-placeholder!"}`}
        >
          <option value="">{placeholder}</option>
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-hive-ink">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-hive-muted" />
      </div>
      {error && (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
