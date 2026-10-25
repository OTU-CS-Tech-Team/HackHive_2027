// Colours an admin can give a schedule category. The key is what event_categories.color
// stores. Full class strings so Tailwind picks them up.
export const COLORS: Record<string, { label: string; bar: string; chip: string }> = {
  amber: { label: "Yellow", bar: "bg-amber-400", chip: "bg-amber-100 text-amber-900 border-amber-300" },
  orange: { label: "Orange", bar: "bg-orange-500", chip: "bg-orange-100 text-orange-900 border-orange-300" },
  rose: { label: "Red", bar: "bg-rose-500", chip: "bg-rose-100 text-rose-900 border-rose-300" },
  fuchsia: { label: "Pink", bar: "bg-fuchsia-500", chip: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
  violet: { label: "Purple", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-900 border-violet-300" },
  indigo: { label: "Indigo", bar: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  sky: { label: "Blue", bar: "bg-sky-500", chip: "bg-sky-100 text-sky-900 border-sky-300" },
  teal: { label: "Teal", bar: "bg-teal-500", chip: "bg-teal-100 text-teal-900 border-teal-300" },
  emerald: { label: "Green", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  lime: { label: "Lime", bar: "bg-lime-500", chip: "bg-lime-100 text-lime-900 border-lime-300" },
  stone: { label: "Brown", bar: "bg-stone-500", chip: "bg-stone-200 text-stone-900 border-stone-400" },
  slate: { label: "Grey", bar: "bg-slate-500", chip: "bg-slate-100 text-slate-900 border-slate-300" },
};

// Unknown keys (e.g. a colour since removed from the list) fall back to grey.
export const colorOf = (key: string | undefined) => COLORS[key ?? ""] ?? COLORS.slate;

type Timed = { starts_at: string; ends_at: string };

// Google Calendar-style placement: events that overlap in one column sit side by side,
// each taking 1/lanes of the width; events that don't overlap get the full width.
export function layoutLanes<T extends Timed>(events: T[]) {
  const sorted = [...events].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const placed: { event: T; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const event of sorted) {
    const start = Date.parse(event.starts_at);
    const end = Date.parse(event.ends_at);
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    clusterEnd = Math.max(clusterEnd, end);
    const p = { event, lane, lanes: 0 };
    cluster.push(p);
    placed.push(p);
  }
  flush();
  return placed;
}
