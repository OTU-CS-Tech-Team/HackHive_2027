import type { ApplicationStats, Breakdown } from "@/lib/admin/stats";

const card = "rounded-lg border border-neutral-200 bg-white p-5";
const number = (value: number) => value.toLocaleString("en-US");

function Metric({ label, value, detail, accent = false }: { label: string; value: number; detail: string; accent?: boolean }) {
  return <div className={`rounded-lg border p-5 ${accent ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
    <dt className="text-sm font-medium text-neutral-600">{label}</dt>
    <dd className="mt-3 text-4xl font-bold tracking-tight tabular-nums">{number(value)}</dd>
    <p className="mt-2 text-xs text-neutral-600">{detail}</p>
  </div>;
}

function Distribution({ title, description, rows, total }: { title: string; description: string; rows: Breakdown; total: number }) {
  const shown = rows.slice(0, 8);
  const remaining = rows.slice(8).reduce((sum, row) => sum + row.count, 0);
  const display = remaining ? [...shown, { label: "Other responses", count: remaining }] : shown;
  return <section className={card}>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mt-1 mb-5 text-sm text-neutral-600">{description}</p>
    {display.length ? <ul className="space-y-4">
      {display.map(row => <li key={row.label}>
        <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
          <span className="min-w-0 break-words">{row.label}</span>
          <span className="shrink-0 font-medium tabular-nums">{number(row.count)} <span className="font-normal text-neutral-500">· {Math.round(row.count / total * 100)}%</span></span>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.count / total * 100}%` }} />
        </div>
      </li>)}
    </ul> : <p className="text-sm text-neutral-500">No submitted applications yet.</p>}
  </section>;
}

export function StatsOverview({ stats }: { stats: ApplicationStats }) {
  return <div className="space-y-6">
    {stats.total === 0 && <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
      No applications yet. This overview will fill in as hackers save drafts and submit applications.
    </p>}
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Submitted applications" value={stats.submitted} detail="Completed applications received" accent />
      <Metric label="Approved applicants" value={stats.approved} detail="Applications approved by an organizer" />
      <Metric label="Pending review" value={stats.pending} detail="Submitted applications awaiting a decision" />
      <Metric label="Submitted in the last 7 days" value={stats.lastSevenDays} detail="Rolling seven-day submission window" />
    </dl>

    <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
      <div>
        <h2 className="text-lg font-semibold">Application progress</h2>
        <p className="mt-1 text-sm text-neutral-600">{number(stats.submitted)} submitted and {number(stats.drafts)} drafts out of {number(stats.total)} applications started.</p>
      </div>
      <p className="text-2xl font-bold tabular-nums">{stats.total ? `${Math.round(stats.submitted / stats.total * 100)}%` : "—"} <span className="text-sm font-normal text-neutral-600">submitted</span></p>
    </section>

    <section className={card}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Admissions decisions</h2>
          <p className="mt-1 text-sm text-neutral-600">Track the review queue and admission outcomes.</p>
        </div>
        <span className="text-sm text-neutral-600">{stats.submitted ? `${Math.round((stats.submitted - stats.pending) / stats.submitted * 100)}% reviewed` : "No submissions yet"}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["pending", "Pending review"], ["approved", "Approved"], ["waitlisted", "Waitlisted"], ["rejected", "Rejected"],
        ] as const).map(([decision, label]) => <div key={decision} className={`rounded-lg p-4 ${decision === "approved" ? "bg-green-50" : decision === "pending" ? "bg-amber-50" : "bg-neutral-50"}`}>
          <dt className="text-sm font-medium">{label}</dt>
          <dd className="mt-2 text-3xl font-bold tabular-nums">{number(stats[decision])}</dd>
        </div>)}
      </dl>
      <p className="mt-4 text-xs text-neutral-500">Approved means an organizer has approved the application; it does not mean the hacker has confirmed attendance or checked in.</p>
    </section>

    <div className="grid items-start gap-6 md:grid-cols-2">
      <Distribution title="Team formation" description={`Team preferences from submitted applications, not confirmed teams. ${number(stats.firstTime)} applicants are first-time hackers (including HackHive 2027).`} total={stats.submitted}
        rows={stats.submitted ? [
          { label: "Looking for teammates", count: stats.lookingForTeam },
          { label: "Already has a team", count: stats.hasTeam },
          { label: "Participating solo", count: stats.solo },
          { label: "Not provided", count: stats.submitted - stats.lookingForTeam - stats.hasTeam - stats.solo },
        ] : []} />
      <section className={card}>
        <h2 className="text-lg font-semibold">Planning & support</h2>
        <p className="mt-1 mb-5 text-sm text-neutral-600">Requests from submitted applicants. Use these to plan support ahead of admissions.</p>
        <dl className="divide-y divide-neutral-100">
          {[
            ["Travel assistance requested", stats.travelHelp],
            ["Dietary responses provided", stats.dietaryRequests],
            ["Accessibility responses provided", stats.accessibilityRequests],
            ["Hackathon experience not provided", stats.experienceUnknown],
          ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-neutral-600">{label}</dt><dd className="font-semibold tabular-nums">{number(value as number)}</dd>
          </div>)}
        </dl>
        <p className="mt-3 text-xs text-neutral-500">A dietary or accessibility response may say “none”; these counts show responses, not confirmed needs.</p>
      </section>
      <Distribution title="Schools represented" description="School responses from submitted applications. Matching ignores case and surrounding spaces." rows={stats.schools} total={stats.submitted} />
      <Distribution title="T-shirt sizes" description="Requested sizes across submitted applications. These are planning estimates, not a confirmed attendee order." rows={stats.shirts} total={stats.submitted} />
    </div>
    <p className="text-sm text-neutral-500">Community and logistics counts include submitted applications only. Draft responses are excluded.</p>
  </div>;
}
