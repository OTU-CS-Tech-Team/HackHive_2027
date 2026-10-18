"use client";

import { useId } from "react";

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
      <legend className="block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </legend>
      {description && (
        <p id={descriptionId} className="text-sm text-neutral-500">
          {description}
        </p>
      )}
      <div className="space-y-2">
        {normalizedOptions.map((opt) => (
          <div key={opt.value} className="flex items-center gap-3">
            <input
              id={`${groupId}-${opt.value}`}
              name={name}
              type="radio"
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              disabled={disabled}
              className="h-4 w-4 border-neutral-300 text-neutral-900 focus:ring-neutral-900 disabled:cursor-not-allowed"
            />
            <label htmlFor={`${groupId}-${opt.value}`} className="text-sm text-neutral-700">
              {opt.label}
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
