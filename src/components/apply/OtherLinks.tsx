"use client";

import { useId } from "react";
import { FIELD_LIMITS } from "@/lib/constants";

interface OtherLinksProps {
  value: string[];
  onChange: (links: string[]) => void;
  error?: string;
}

// Extra profile links (Devpost, blog, ...). For reviewers only; the
// indemnification form prints just LinkedIn, GitHub and portfolio.
export function OtherLinks({ value, onChange, error }: OtherLinksProps) {
  const id = useId();
  const canAddMore = value.length < FIELD_LIMITS.other_links_max;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <>
          <p className="block text-sm font-medium text-neutral-700">Other links</p>
          {value.map((link, index) => (
            <div key={index} className="flex gap-2">
              <label htmlFor={`${id}-${index}`} className="sr-only">
                Other link {index + 1}
              </label>
              <input
                id={`${id}-${index}`}
                name={index === 0 ? "other_links" : undefined}
                type="url"
                value={link}
                onChange={(e) => onChange(value.map((l, i) => (i === index ? e.target.value : l)))}
                maxLength={FIELD_LIMITS.other_link}
                placeholder="https://devpost.com/..."
                aria-invalid={error ? "true" : undefined}
                className={`block w-full rounded-lg border px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900"
                }`}
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-600 hover:bg-neutral-50"
                aria-label={`Remove link ${index + 1}`}
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
          ))}
        </>
      )}

      {canAddMore && (
        <button
          type="button"
          onClick={() => onChange([...value, ""])}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-900 underline hover:no-underline"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add another link (Devpost, blog, etc.)
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
