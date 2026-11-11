"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownProps {
  deadline: number;
  serverNow: number;
  deadlineLabel: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatTimeLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 86400)}d ${pad(Math.floor(s / 3600) % 24)}h ${pad(Math.floor(s / 60) % 60)}m ${pad(s % 60)}s`;
}

// Starts from the server's clock so the first paint matches, then ticks locally.
export function Countdown({ deadline, serverNow, deadlineLabel }: CountdownProps) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border border-hive-line bg-white/80 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-hive-honey-soft text-hive-ink">
          <Clock className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-hive-ink">Applications close in</p>
          <p className="text-xs text-hive-muted">{deadlineLabel}</p>
        </div>
      </div>
      <p className="font-display text-xl font-bold tracking-tight text-hive-ink tabular-nums" role="timer" aria-live="off">
        {formatTimeLeft(deadline - now)}
      </p>
    </div>
  );
}
