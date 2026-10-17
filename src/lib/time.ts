// Fixed timezone so server and browser render the same text (no hydration mismatch).
const TZ = "America/Toronto";

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

export const formatDateTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

// <input type="datetime-local"> values ("2027-02-20T09:00"), read and written as Toronto wall time.
export const toLocalInput = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16).replace(" ", "T");

export function fromLocalInput(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error(`Bad date: ${local}`);
  const asUtc = Date.parse(`${local}:00Z`);
  // Toronto's offset at that moment (e.g. -5h), so DST is handled.
  const offset = Date.parse(`${toLocalInput(new Date(asUtc).toISOString())}:00Z`) - asUtc;
  return new Date(asUtc - offset).toISOString();
}
