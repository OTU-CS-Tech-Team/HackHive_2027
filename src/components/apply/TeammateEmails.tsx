"use client";

import { useState, useId } from "react";
import { suggestEmailCorrection } from "@/lib/application/form-utils";
import { FIELD_LIMITS } from "@/lib/application/schema";

interface TeammateEmailsProps {
  value: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function TeammateEmails({ value, onChange, disabled = false, error }: TeammateEmailsProps) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<Record<number, string | null>>({});

  const canAddMore = value.length < FIELD_LIMITS.teammate_emails_max;

  const handleEmailChange = (index: number, email: string) => {
    const newEmails = [...value];
    newEmails[index] = email;
    onChange(newEmails);

    const suggestion = suggestEmailCorrection(email);
    setSuggestions((prev) => ({ ...prev, [index]: suggestion }));
  };

  const handleAddEmail = () => {
    if (canAddMore) {
      onChange([...value, ""]);
    }
  };

  const handleRemoveEmail = (index: number) => {
    const newEmails = value.filter((_, i) => i !== index);
    onChange(newEmails);
    setSuggestions((prev) => {
      const newSuggestions = { ...prev };
      delete newSuggestions[index];
      return newSuggestions;
    });
  };

  const handleAcceptSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (suggestion) {
      handleEmailChange(index, suggestion);
      setSuggestions((prev) => ({ ...prev, [index]: null }));
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-700">
        Teammate emails (optional, up to {FIELD_LIMITS.teammate_emails_max})
      </label>
      <p className="text-sm text-neutral-500">
        Enter the email addresses of teammates you&apos;re planning to work with.
      </p>

      {value.map((email, index) => (
        <div key={index} className="space-y-1">
          <div className="flex gap-2">
            <input
              id={`${id}-${index}`}
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(index, e.target.value)}
              disabled={disabled}
              placeholder="teammate@example.com"
              className="block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100"
            />
            <button
              type="button"
              onClick={() => handleRemoveEmail(index)}
              disabled={disabled}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Remove teammate ${index + 1}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {suggestions[index] && (
            <p className="text-sm text-neutral-600">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => handleAcceptSuggestion(index)}
                className="font-medium text-neutral-900 underline hover:no-underline"
              >
                {suggestions[index]}
              </button>
              ?
            </p>
          )}
        </div>
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={handleAddEmail}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-900 underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add teammate
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
