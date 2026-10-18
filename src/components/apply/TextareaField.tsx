"use client";

import { useId } from "react";
import { countWords } from "@/lib/application/form-utils";

interface TextareaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  wordLimit?: number;
  rows?: number;
  error?: string;
  description?: string;
}

export function TextareaField({
  label,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  maxLength,
  wordLimit,
  rows = 4,
  error,
  description,
}: TextareaFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const wordCountId = `${id}-wordcount`;

  const wordCount = countWords(value);
  const isOverWordLimit = wordLimit && wordCount > wordLimit;

  const describedBy = [
    description ? descriptionId : null,
    wordLimit ? wordCountId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </label>
      {description && (
        <p id={descriptionId} className="text-sm text-neutral-500">
          {description}
        </p>
      )}
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={error || isOverWordLimit ? "true" : undefined}
        aria-describedby={describedBy}
        className={`mt-1 block w-full resize-y rounded-lg border px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 ${
          error || isOverWordLimit
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900"
        }`}
      />
      <div className="flex items-center justify-between text-xs">
        {wordLimit ? (
          <p
            id={wordCountId}
            className={isOverWordLimit ? "font-medium text-red-600" : "text-neutral-500"}
            aria-live="polite"
          >
            {wordCount}/{wordLimit} words
            {isOverWordLimit && " (over limit)"}
          </p>
        ) : (
          <span />
        )}
        {maxLength && (
          <p className="text-neutral-400">
            {value.length}/{maxLength} characters
          </p>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
