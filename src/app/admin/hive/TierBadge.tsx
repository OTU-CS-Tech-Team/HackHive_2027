import { FLAG_LABELS, minorNote, type HiveFlag } from "@/lib/hive/flags";
import { TIER_EMOJI, TIER_LABELS, type Tier } from "@/lib/hive/tier";

const TIER_STYLES: Record<Tier, string> = {
  queen: "bg-amber-100 text-amber-900 ring-amber-300",
  worker: "bg-yellow-50 text-yellow-900 ring-yellow-300",
  larva: "bg-lime-50 text-lime-900 ring-lime-300",
};

const pill = "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function TierBadge({ tier, overridden = false }: { tier: Tier | null; overridden?: boolean }) {
  if (!tier) return <span className={`${pill} bg-neutral-50 text-neutral-600 ring-neutral-300`}>Unscored</span>;
  return (
    <span className={`${pill} ${TIER_STYLES[tier]}`}>
      <span aria-hidden>{TIER_EMOJI[tier]}</span>
      {TIER_LABELS[tier]}
      {overridden && <span className="font-normal opacity-75">· moved</span>}
    </span>
  );
}

export function MinorPill({ age }: { age: number }) {
  return (
    <span className={`${pill} bg-red-50 text-red-800 ring-red-300`} title={minorNote(age)}>
      ⚠ Minor ({age})
    </span>
  );
}

export function FlagPills({ flags }: { flags: string[] }) {
  const shown = flags.filter((flag) => flag !== "minor" && Object.hasOwn(FLAG_LABELS, flag)) as HiveFlag[];
  return shown.map((flag) => (
    <span key={flag} className={`${pill} bg-amber-50 text-amber-900 ring-amber-300`}>
      {FLAG_LABELS[flag]}
    </span>
  ));
}
