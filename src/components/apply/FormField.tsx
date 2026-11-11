"use client";

import { useId } from "react";
import { errorClass, hintClass, inputClass, labelClass, Optional } from "./styles";

interface FormFieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "tel" | "number" | "url" | "date";
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  error?: string;
  description?: string;
  autoComplete?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  maxLength,
  min,
  max,
  error,
  description,
  autoComplete,
}: FormFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {!required && !disabled && <Optional />}
      </label>
      {description && (
        <p id={descriptionId} className={hintClass}>
          {description}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={inputClass(error)}
      />
      {error && (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
