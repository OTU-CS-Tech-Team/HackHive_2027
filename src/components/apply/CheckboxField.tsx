"use client";

import { useId } from "react";

interface CheckboxFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
}

export function CheckboxField({
  label,
  name,
  checked,
  onChange,
  required = false,
  disabled = false,
  error,
  description,
}: CheckboxFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 disabled:cursor-not-allowed"
        />
        <label htmlFor={id} className="text-sm text-neutral-700">
          {label}
          {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      </div>
      {description && (
        <p id={descriptionId} className="ml-7 text-sm text-neutral-500">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="ml-7 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
