"use client";

import { useId } from "react";
import { errorClass, hintClass, labelClass } from "./styles";

interface RadioGroupFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[] | readonly string[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
}

export function RadioGroupField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  description,
}: RadioGroupFieldProps) {
  const groupId = useId();
  const descriptionId = `${groupId}-description`;
  const errorId = `${groupId}-error`;

  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  return (
    <fieldset className="space-y-2" aria-describedby={describedBy}>
      <legend className={`${labelClass} mb-2`}>{label}</legend>
      {description && (
        <p id={descriptionId} className={hintClass}>
          {description}
        </p>
      )}
      <div className="grid gap-2.5 sm:grid-cols-3">
        {normalizedOptions.map((opt) => (
          <div
            key={opt.value}
            className="relative flex items-center gap-3 rounded-xl border border-hive-line bg-hive-field px-4 py-3.5 transition-colors hover:border-[#d9cfb8] has-checked:border-hive-honey has-checked:bg-hive-honey-soft has-focus-visible:ring-4 has-focus-visible:ring-hive-honey/25"
          >
            <input
              id={`${groupId}-${opt.value}`}
              name={name}
              type="radio"
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              disabled={disabled}
              className="size-4 shrink-0 accent-hive-ink outline-none disabled:cursor-not-allowed"
            />
            <label htmlFor={`${groupId}-${opt.value}`} className="text-sm font-medium text-hive-ink after:absolute after:inset-0">
              {opt.label}
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
