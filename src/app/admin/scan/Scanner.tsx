"use client";

/* eslint-disable @next/next/no-img-element -- avatars come from Storage / OAuth providers */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import QrScanner from "qr-scanner";
import { awardEventPoints, awardPoints, lookupHacker, redeemItem, type ActionResult, type ScannedHacker } from "../actions";

export type ScanEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  starts_at: string | null;
  ends_at: string | null;
  points: number | null;
};
type ItemOption = { id: string; name: string; cost: number; stock: number | null };

const TIME_ZONE = "America/Toronto";
const EVENT_DAYS = ["2027-01-29", "2027-01-30", "2027-01-31"];
const LOCK_TIME = 500; // how long a code must stay in view before we lock onto it

const field = "rounded border border-neutral-300 px-3 py-2";
const button = "rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50";

const dayKey = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) : "";
const dayChip = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const timeLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: TIME_ZONE,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No time set";
const clip = (text: string, max = 125) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

type View = { type: "list" } | { type: "scan"; event: ScanEvent } | { type: "info" };
type Popup = { ok: boolean; name?: string; message: string; balance?: number; points?: number };

export function Scanner({ events, items }: { events: ScanEvent[]; items: ItemOption[] }) {
  const [view, setView] = useState<View>({ type: "list" });
  const [day, setDay] = useState("all");
  const [category, setCategory] = useState("all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false); // camera paused while a code is being handled
  const [status, setStatus] = useState<string | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [hacker, setHacker] = useState<ScannedHacker | null>(null); // Info view only
  const [result, setResult] = useState<ActionResult | null>(null);
  const [itemId, setItemId] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 60_000);
  return () => clearInterval(id);
}, []);
  const categories = useMemo(
    () => [...new Set(events.map((e) => e.category?.trim()).filter((c): c is string => !!c))].sort(),
    [events],
  );
 const visible = useMemo(() => {
  return events.filter((e) => {
    if (day !== "all" && dayKey(e.starts_at) !== day) return false;
    if (category !== "all" && e.category?.trim() !== category) return false;
    if (upcomingOnly) {
      const end = Date.parse(e.ends_at ?? e.starts_at ?? "");
      if (Number.isNaN(end) || end < now) return false;
    }
    return true;
  });
}, [events, day, category, upcomingOnly, now]);

  function reset() {
    setLocked(false);
    setStatus(null);
    setPopup(null);
    setHacker(null);
    setResult(null);
    setItemId("");
  }
  function go(next: View) {
    reset();
    setView(next);
  }

  async function handleLock(token: string) {
    setLocked(true);
    setStatus("Reading code…");
    const found = await lookupHacker(token).catch(() => ({ error: "Network error, scan again." }));
    setStatus(null);
    if ("error" in found) {
      setPopup({ ok: false, message: found.error });
      return;
    }
    if (view.type === "scan") {
      const ev = view.event;
      if (found.checkedIn.includes(ev.id)) {
        setPopup({ ok: false, name: found.name, message: `${found.name} is already checked in to ${ev.title}.` });
        return;
      }
      const outcome = await awardEventPoints(found.id, ev.id).catch(
        (): ActionResult => ({ ok: false, message: "Network error, try again." }),
      );
      setPopup({
        ok: outcome.ok,
        name: found.name,
        message: outcome.message,
        balance: outcome.balance,
        points: outcome.ok ? (ev.points ?? 0) : undefined,
      });
    } else if (view.type === "info") {
      setHacker(found);
    }
  }

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.balance !== undefined) setHacker((prev) => prev && { ...prev, balance: outcome.balance! });
    });
  }

  const tab = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
    }`;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-neutral-900 bg-neutral-900 text-white"
        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
    }`;

  return (
    <div className="w-full">
      {/* Top bar */}
      <div className="mb-3 flex rounded-xl bg-neutral-100 p-1">
        <button className={tab(view.type !== "info")} onClick={() => go({ type: "list" })}>
          Events
        </button>
        <button className={tab(view.type === "info")} onClick={() => go({ type: "info" })}>
          Info
        </button>
      </div>

      {/* Event list */}
      {view.type === "list" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto">
              <button className={chip(day === "all")} onClick={() => setDay("all")}>
                All days
              </button>
              {EVENT_DAYS.map((key) => (
                <button key={key} className={chip(day === key)} onClick={() => setDay(key)}>
                  {dayChip(key)}
                </button>
              ))}
                <button
                  className={chip(upcomingOnly)}
                  onClick={() => setUpcomingOnly((v) => !v)}
                  aria-pressed={upcomingOnly}
                >
                Upcoming
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <ul className="space-y-1.5">
            {visible.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => go({ type: "scan", event: ev })}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-tight">{ev.title}</p>
                    {ev.description && (
                      <p className="mt-0.5 text-xs font-normal leading-snug text-neutral-600">{clip(ev.description)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[11px] leading-snug text-neutral-500">
                    <p>{ev.points ?? 0} pts</p>
                    <p>{timeLabel(ev.starts_at)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-500">No events match these filters.</p>
          )}
        </>
      )}

      {/* Scan / Info */}
      {view.type !== "list" && (
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{view.type === "scan" ? view.event.title : "Attendee info"}</p>
              <p className="text-xs text-neutral-500">
                {view.type === "scan"
                  ? `+${view.event.points ?? 0} pts per scan`
                  : "Scan a pass for points, emergency info, redemptions"}
              </p>
            </div>
            <button onClick={() => go({ type: "list" })} className="shrink-0 text-sm text-neutral-600 hover:underline">
              ← Back
            </button>
          </div>

          <Camera
            key={view.type === "scan" ? view.event.id : "info"}
            locked={locked}
            hidden={!!hacker}
            onLock={handleLock}
            onError={(message) => setPopup({ ok: false, message })}
          />

          {status && <p role="status" className="rounded bg-neutral-100 p-3 text-sm">{status}</p>}

          {/* Info panel (same tools as the old scanner, minus the event picker) */}
          {hacker && (
            <>
              <section className="flex items-center gap-4 rounded-lg border p-4">
                {hacker.avatar_url ? (
                  <img src={hacker.avatar_url} alt="" referrerPolicy="no-referrer" className="size-16 rounded-full object-cover" />
                ) : (
                  <span className="size-16 rounded-full bg-neutral-200" aria-hidden />
                )}
                <div className="flex-1">
                  <p className="text-lg font-semibold">{hacker.name}</p>
                  <p className="text-sm text-neutral-600">{[hacker.email, hacker.school].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="text-right">
                  <span className="block text-2xl font-bold">{hacker.balance}</span>
                  <span className="text-xs text-neutral-600">points</span>
                </p>
              </section>

              <details open className="rounded-lg border border-red-300 p-4">
                <summary className="cursor-pointer font-semibold text-red-800">Emergency info</summary>
                {hacker.emergency ? (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="font-medium">Contact</dt>
                    <dd>
                      {hacker.emergency.contact_name}
                      {hacker.emergency.relationship && ` (${hacker.emergency.relationship})`}
                    </dd>
                    <dt className="font-medium">Phone</dt>
                    <dd>
                      <a href={`tel:${hacker.emergency.contact_phone}`} className="underline">
                        {hacker.emergency.contact_phone}
                      </a>
                    </dd>
                    <dt className="font-medium">Medical</dt>
                    <dd>{hacker.emergency.medical_notes || "None given"}</dd>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm">They haven&apos;t filled this in.</p>
                )}
              </details>

              {result && (
                <p role="status" className={`rounded p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
                  {result.message}
                </p>
              )}

              <section className="flex flex-col gap-2 rounded-lg border p-4">
                <h2 className="font-semibold">Help desk: redeem</h2>
                <div className="flex gap-2">
                  <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${field} flex-1`}>
                    <option value="">Pick an item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id} disabled={item.cost > hacker.balance}>
                        {item.name} ({item.cost} pts{item.stock !== null && `, ${item.stock} left`})
                      </option>
                    ))}
                  </select>
                  <button className={button} disabled={!itemId || pending} onClick={() => run(() => redeemItem(hacker.id, itemId))}>
                    Redeem
                  </button>
                </div>
              </section>

              <form
                className="flex flex-col gap-2 rounded-lg border p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  run(() => awardPoints(hacker.id, Number(form.get("amount")), String(form.get("reason"))));
                }}
              >
                <h2 className="font-semibold">Custom points (games, corrections…)</h2>
                <div className="flex gap-2">
                  <input name="amount" type="number" step={1} required placeholder="±pts" className={`${field} w-24`} />
                  <input name="reason" required placeholder="Reason" className={`${field} flex-1`} />
                  <button className={button} disabled={pending}>
                    Apply
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={() => {
                  setHacker(null);
                  setResult(null);
                  setItemId("");
                  setLocked(false);
                }}
                className="rounded border px-4 py-3 font-medium"
              >
                Scan next person
              </button>
            </>
          )}
        </div>
      )}

      {/* Result pop-up (event scans, and any scan error) */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
            <p className="text-3xl">{popup.ok ? "✅" : "⚠️"}</p>
            {popup.ok && popup.points !== undefined && <p className="mt-2 text-lg font-bold">+{popup.points} points</p>}
            {popup.name && popup.ok && <p className="text-sm font-medium">{popup.name}</p>}
            <p className="mt-1 text-sm text-neutral-700">{popup.message}</p>
            {popup.balance !== undefined && <p className="mt-1 text-xs text-neutral-500">New balance: {popup.balance}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setPopup(null);
                  setLocked(false);
                }}
                className="flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
              >
                Scan next
              </button>
              <button onClick={() => go({ type: "list" })} className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Camera with the old hold-steady lock. Pauses on lock; resumes when `locked` goes back to false. */
function Camera({
  locked,
  hidden,
  onLock,
  onError,
}: {
  locked: boolean;
  hidden: boolean;
  onLock: (token: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const stableTokenRef = useRef<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [frozen, setFrozen] = useState(false);

  // Always call the latest handlers without restarting the camera.
  const onLockRef = useRef(onLock);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onLockRef.current = onLock;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const scanner = new QrScanner(
      videoRef.current!,
      ({ data }) => {
        if (busyRef.current || stableTokenRef.current === data) return;
        stableTokenRef.current = data;
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(() => {
          if (stableTokenRef.current !== data || busyRef.current) return;
          busyRef.current = true;
          const video = videoRef.current!;
          const canvas = canvasRef.current!;
          if (video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d")?.drawImage(video, 0, 0);
          }
          scanner.pause();
          setFrozen(true);
          onLockRef.current(data);
        }, LOCK_TIME);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
    );
    scannerRef.current = scanner;
    scanner.start().catch((error) => onErrorRef.current(`Camera error: ${error?.message ?? error}`));
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      scanner.destroy();
    };
  }, []);

  // Parent says we're free again: forget the old code and restart.
  useEffect(() => {
    if (locked || !busyRef.current) return;
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    stableTokenRef.current = null;
    busyRef.current = false;
    setFrozen(false);
    scannerRef.current?.start().catch((error) => onErrorRef.current(`Camera error: ${error?.message ?? error}`));
  }, [locked]);

  return (
    <div className="relative overflow-hidden rounded-lg" hidden={hidden}>
      <video ref={videoRef} muted playsInline className="w-full rounded-lg bg-black" hidden={frozen} />
      <canvas ref={canvasRef} className="w-full rounded-lg bg-black" hidden={!frozen} />
    </div>
  );
}