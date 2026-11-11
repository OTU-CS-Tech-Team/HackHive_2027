"use client";

import { useState, useId } from "react";
import { suggestEmailCorrection } from "@/lib/application/form-utils";
import { Plus, X } from "lucide-react";
import { FIELD_LIMITS } from "@/lib/constants";
import { errorClass, hintClass, iconButtonClass, inputClass, labelClass, linkClass } from "./styles";

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
      <p className={labelClass}>
        Teammate emails <span className="font-normal text-hive-muted">(optional, up to {FIELD_LIMITS.teammate_emails_max})</span>
      </p>
      <p className={hintClass}>
        Enter the email addresses of teammates you&apos;re planning to work with.
      </p>

      {value.map((email, index) => (
        <div key={index} className="space-y-1">
          <div className="flex gap-2">
            <input
              id={`${id}-${index}`}
              name={index === 0 ? "teammate_emails" : undefined}
              aria-label={`Teammate ${index + 1} email`}
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(index, e.target.value)}
              disabled={disabled}
              placeholder="teammate@example.com"
              className={inputClass()}
            />
            <button
              type="button"
              onClick={() => handleRemoveEmail(index)}
              disabled={disabled}
              className={iconButtonClass}
              aria-label={`Remove teammate ${index + 1}`}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {suggestions[index] && (
            <p className={hintClass}>
              Did you mean{" "}
              <button
                type="button"
                onClick={() => handleAcceptSuggestion(index)}
                className={linkClass}
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
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-hive-ink hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add teammate
        </button>
      )}

      {error && (
        <p className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
