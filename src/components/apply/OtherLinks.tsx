"use client";

import { useId } from "react";
import { Plus, X } from "lucide-react";
import { FIELD_LIMITS } from "@/lib/constants";
import { errorClass, iconButtonClass, inputClass, labelClass, Optional } from "./styles";

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
          <p className={labelClass}>
            Other links
            <Optional />
          </p>
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
                className={inputClass(error)}
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className={iconButtonClass}
                aria-label={`Remove link ${index + 1}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </>
      )}

      {canAddMore && (
        <button
          type="button"
          onClick={() => onChange([...value, ""])}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-hive-ink hover:opacity-70"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add another link (Devpost, blog, etc.)
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
