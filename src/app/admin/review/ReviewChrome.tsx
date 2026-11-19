import Link from "next/link";
import { POOL_LABELS } from "@/lib/review/pools";
import type { PoolStats } from "@/lib/review/summary";

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";

export function ReviewHeader({ active, description }: { active: "review" | "results"; description: string }) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${ring} ${
        isActive ? "border-amber-500 text-neutral-900" : "border-transparent text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reviews</h1>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <nav aria-label="Reviews" className="mt-4 flex gap-1 border-b border-neutral-200">
        {tab("/admin/review", "Review", active === "review")}
        {tab("/admin/review/results", "Results", active === "results")}
      </nav>
    </header>
  );
}

const percent = (count: number, target: number) => (target > 0 ? Math.round((count / target) * 100) : 0);

export function PoolBars({ stats }: { stats: PoolStats }) {
  return (
    <section aria-label="Seat pools" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.pools.map(({ pool, count, target }) => {
        const pct = percent(count, target);
        return (
          <div key={pool} className="rounded-lg border border-neutral-200 p-4">
            <p className="text-sm font-medium">{POOL_LABELS[pool]}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {count} <span className="text-base font-medium text-neutral-500">/ {target}</span>
              <span className="ml-2 text-sm font-medium text-neutral-600">{pct}%</span>
            </p>
            <div
              role="progressbar"
              aria-label={`${POOL_LABELS[pool]} seats filled`}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuenow={count}
              className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
            >
              <div className={`h-full rounded-full ${count >= target ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      })}
      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Waitlist</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{stats.waitlisted}</p>
        <p className="mt-1 text-sm text-neutral-600 tabular-nums">
          {stats.rejected} not accepted
        </p>
      </div>
    </section>
  );
}
