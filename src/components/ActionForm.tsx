"use client";

import { useState, useTransition } from "react";

// Submits via onSubmit rather than <form action> so a failed save doesn't
// reset what the hacker typed (React resets forms after form actions).
export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<string>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => setMessage(await action(formData)));
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
