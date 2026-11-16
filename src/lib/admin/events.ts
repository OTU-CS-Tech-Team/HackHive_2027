export type Events = {
  title: string;
  description: string | null;
  category: string | null;
  starts_at: string | null;
  ends_at: string | null;
  points: number | null;
};

export type EventItem = {
  details: { title: string; description: string | null };
  date: string;            
  startsAt: string | null; 
  endsAt: string | null;
  points: number | null;
  category: string | null;
};

export type EventDay = {
  label: string;
  count: number;
  events: EventItem[];
};

const timeLabel = (ms: number) =>
  new Date(ms).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }); // e.g. "Fri, Jan 29, 6:00 PM"
export type Breakdown = { label: string; count: number }[];

const TIME_ZONE = "America/Toronto"; // used when grouping by month / weekday

function breakdown(values: (string | null)[]): Breakdown {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    const label = value?.trim() || "Not provided";
    const key = label.toLocaleLowerCase("en-US");
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const toTime = (value: string | null): number | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};
// Put these above summarizeEvents
const EVENT_DAYS = ["2027-01-29", "2027-01-30", "2027-01-31"]; // YYYY-MM-DD, Toronto time

const dayKey = (ms: number) =>
  new Date(ms).toLocaleDateString("en-CA", { timeZone: TIME_ZONE }); // en-CA gives YYYY-MM-DD

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }); // e.g. "Friday, Jan 29"

 
export function summarizeEvents(events: Events[], now = new Date()) {
  const nowMs = now.getTime();
  const DAY = 24 * 60 * 60 * 1000;

  // If an event has no end time, treat it as ending when it starts.
  const parsed = events.map(row => {
    const start = toTime(row.starts_at);
    const end = toTime(row.ends_at) ?? start;
    return { row, start, end };
  });

  const dated = parsed.filter(e => e.start !== null && e.end !== null);
  const upcoming = dated.filter(e => e.start! > nowMs);
  const current = dated.filter(e => e.start! <= nowMs && e.end! >= nowMs);
  const past = dated.filter(e => e.end! < nowMs);

  const nextEvent = [...upcoming].sort((a, b) => a.start! - b.start!)[0]?.row ?? null;

  const pointValues = events
    .map(r => r.points)
    .filter((p): p is number => typeof p === "number");
  const totalPoints = pointValues.reduce((sum, p) => sum + p, 0);

  const durationsHours = dated
    .filter(e => e.end! >= e.start!)
    .map(e => (e.end! - e.start!) / 36e5);

  return {
    total: events.length,
    categories: breakdown(events.map(row => row.category)),

    // timing
    upcoming: upcoming.length,
    current: current.length,
    past: past.length,
    undated: events.length - dated.length,

    nextEvent, // full row or null; use nextEvent?.title in the UI

    // points
    totalPoints,
    maxPoints: pointValues.length ? Math.max(...pointValues) : null,
    noPoints: events.filter(r => !r.points).length,

    // data quality
    missingDescription: events.filter(r => !r.description?.trim()).length,
    missingCategory: events.filter(r => !r.category?.trim()).length,

    // events per day (Jan 29 to 31, 2027)
        // events per day (Jan 29 to 31, 2027), earliest first within each day
    byDay: EVENT_DAYS.map((key): EventDay => {
      const events = dated
        .filter(e => dayKey(e.start!) === key)
        .sort((a, b) => a.start! - b.start!)
        .map(({ row, start }): EventItem => ({
          details: { title: row.title, description: row.description },
          date: timeLabel(start!),
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          points: row.points,
          category: row.category,
        }));
      return { label: dayLabel(key), count: events.length, events };
    }),
  };
}

export type EventStats = ReturnType<typeof summarizeEvents>;