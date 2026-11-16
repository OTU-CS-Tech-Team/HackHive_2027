"use client";
/* eslint-disable @next/next/no-img-element -- avatars come from Storage / OAuth providers */

import { useState } from "react";
import { UserRound } from "lucide-react";

// A hacker's photo, or a grey person icon when they have none or it fails to
// load (an expired Google link, a deleted upload). Size it with className.
export function Avatar({ src, className = "" }: { src?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const base = `shrink-0 overflow-hidden rounded-full ${className}`;

  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        // A server-rendered image can fail before React attaches onError; catch that on mount.
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setFailed(src);
        }}
        className={`${base} object-cover`}
      />
    );
  }
  return (
    <span className={`${base} flex items-center justify-center bg-neutral-200 text-neutral-500`} aria-hidden>
      <UserRound className="size-3/5" strokeWidth={1.75} />
    </span>
  );
}
