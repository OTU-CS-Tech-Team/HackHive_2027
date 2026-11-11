"use client";

import { useId } from "react";
import { countWords } from "@/lib/application/form-utils";
import { errorClass, hintClass, labelClass, Optional, textareaClass } from "./styles";

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
    <div className="space-y-2">
      <label htmlFor={id} className={`${labelClass} leading-snug`}>
        {label}
        {!required && <Optional />}
      </label>
      {description && (
        <p id={descriptionId} className={hintClass}>
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
        className={textareaClass(error || isOverWordLimit)}
      />
      <div className="flex items-center justify-between text-xs tabular-nums">
        {wordLimit ? (
          <p
            id={wordCountId}
            className={isOverWordLimit ? "font-semibold text-red-600" : "text-hive-muted"}
            aria-live="polite"
          >
            {wordCount}/{wordLimit} words
            {isOverWordLimit && " (over limit)"}
          </p>
        ) : (
          <span />
        )}
        {maxLength && (
          <p className="text-hive-muted">
            {value.length}/{maxLength} characters
          </p>
        )}
      </div>
      {error && (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
