"use client";

import { useId } from "react";
import { errorClass } from "./styles";

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
    <div className="space-y-1.5">
      <div
        className={`relative flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors has-checked:bg-hive-honey-soft has-focus-visible:ring-4 has-focus-visible:ring-hive-honey/25 ${
          error ? "border-red-500" : "border-hive-line bg-hive-field hover:border-[#d9cfb8] has-checked:border-hive-honey"
        }`}
      >
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
          className="mt-0.5 size-4 shrink-0 accent-hive-ink outline-none disabled:cursor-not-allowed"
        />
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-medium text-hive-ink after:absolute after:inset-0">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-[13px] text-hive-muted">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
