"use client";

/* eslint-disable @next/next/no-img-element -- avatars come from Storage / OAuth providers */
import { useEffect, useRef, useState, useTransition } from "react";
import QrScanner from "qr-scanner";
import { awardEventPoints, awardPoints, lookupHacker, redeemItem, type ActionResult, type ScannedHacker } from "../actions";

type EventOption = { id: string; title: string; points: number };
type ItemOption = { id: string; name: string; cost: number; stock: number | null };

const field = "rounded border border-neutral-300 px-3 py-2";
const button = "rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50";

// How long the same code has to stay in view before we lock onto it.
const LOCK_TIME = 500;

export function Scanner({ events, items }: { events: EventOption[]; items: ItemOption[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false); // the camera keeps firing while a lookup is in flight
  const stableTokenRef = useRef<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [hacker, setHacker] = useState<ScannedHacker | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // Remembered between scans, so a check-in desk can scan a whole line for one event.
  const [eventId, setEventId] = useState("");
  const [itemId, setItemId] = useState("");

  useEffect(() => {
    // Freeze the frame the code was locked on, then look the person up.
    async function capture(token: string) {
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
      setResult({ ok: true, message: "Reading code…" });
      const found = await lookupHacker(token).catch(() => ({ error: "Network error, scan again." }));
      if ("error" in found) {
        setResult({ ok: false, message: found.error });
      } else {
        setResult(null);
        setHacker(found);
      }
    }

    // Detect -> hold steady for LOCK_TIME -> capture. A different code restarts the wait.
    const scanner = new QrScanner(
      videoRef.current!,
      ({ data }) => {
        if (busyRef.current || stableTokenRef.current === data) return;
        stableTokenRef.current = data;
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(() => {
          if (stableTokenRef.current === data && !busyRef.current) void capture(data);
        }, LOCK_TIME);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
    );
    scannerRef.current = scanner;
    scanner.start().catch((error) => setResult({ ok: false, message: `Camera error: ${error?.message ?? error}` }));
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      scanner.destroy();
    };
  }, []);

  function scanNext() {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    stableTokenRef.current = null;
    busyRef.current = false;
    setHacker(null);
    setResult(null);
    setFrozen(false);
    scannerRef.current?.start().catch((error) => setResult({ ok: false, message: `Camera error: ${error?.message ?? error}` }));
  }

  function run(action: () => Promise<ActionResult>, eventIdForCheckin?: string) {
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.balance !== undefined) setHacker((prev) => prev && { ...prev, balance: outcome.balance! });
      if (outcome.ok && eventIdForCheckin) setHacker((prev) => prev && { ...prev, checkedIn: [...prev.checkedIn, eventIdForCheckin] });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* qr-scanner draws the scan region + code outline over the video; the canvas holds the frozen frame. */}
      <div className="relative" hidden={!!hacker}>
        <video ref={videoRef} muted playsInline className="w-full rounded-lg bg-black" hidden={frozen} />
        <canvas ref={canvasRef} className="w-full rounded-lg bg-black" hidden={!frozen} />
      </div>

      {result && (
        <p role="status" className={`rounded p-3 ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
          {result.message}
        </p>
      )}

      {frozen && !hacker && result && !result.ok && (
        <button type="button" onClick={scanNext} className="rounded border px-4 py-3 font-medium">
          Scan again
        </button>
      )}

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

          <details className="rounded-lg border border-red-300 p-4">
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

          <section className="flex flex-col gap-2 rounded-lg border p-4">
            <h2 className="font-semibold">Event check-in</h2>
            <div className="flex gap-2">
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${field} flex-1`}>
                <option value="">Pick an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id} disabled={hacker.checkedIn.includes(event.id)}>
                    {hacker.checkedIn.includes(event.id) ? "✓ " : ""}
                    {event.title} (+{event.points})
                  </option>
                ))}
              </select>
              <button
                className={button}
                disabled={!eventId || pending || hacker.checkedIn.includes(eventId)}
                onClick={() => run(() => awardEventPoints(hacker.id, eventId), eventId)}
              >
                Award
              </button>
            </div>
            {hacker.checkedIn.includes(eventId) && <p className="text-sm text-amber-800">Already checked in to this event.</p>}
          </section>

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
            <h2 className="font-semibold">Custom points (Bee games, corrections…)</h2>
            <div className="flex gap-2">
              <input name="amount" type="number" step={1} required placeholder="±pts" className={`${field} w-24`} />
              <input name="reason" required placeholder="Reason" className={`${field} flex-1`} />
              <button className={button} disabled={pending}>
                Apply
              </button>
            </div>
          </form>

          <button type="button" onClick={scanNext} className="rounded border px-4 py-3 font-medium">
            Scan next person
          </button>
        </>
      )}
    </div>
  );
}
