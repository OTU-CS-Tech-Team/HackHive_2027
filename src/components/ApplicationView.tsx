import Link from "next/link";
import { Check, ChevronDown, ExternalLink, FileSignature, FileText, PencilLine } from "lucide-react";
import type { Application } from "@/lib/application/schema";
import { formatDay } from "@/lib/time";

const BADGES = {
  draft: ["Draft", "bg-neutral-100 text-neutral-800"],
  applied: ["Pending review", "bg-blue-100 text-blue-800"],
  accepted: ["Accepted", "bg-green-100 text-green-800"],
  waitlisted: ["Waitlisted", "bg-yellow-100 text-yellow-800"],
  rejected: ["Not accepted", "bg-neutral-200 text-neutral-800"],
} as const;

type Status = keyof typeof BADGES;

const HEADLINES: Record<Status, string> = {
  draft: "Your application isn't submitted yet",
  applied: "Application submitted",
  accepted: "You're in!",
  waitlisted: "You're on the waitlist",
  rejected: "Thanks for applying",
};

const NEXT_STEPS: Record<Status, string> = {
  draft: "Your answers are saved, but we can't review them until you submit.",
  applied: "We've got your application and will email you a decision. The rest of the dashboard unlocks if you're accepted.",
  accepted: "The full hacker dashboard is unlocked: schedule, your pass, teammates, hardware and points.",
  waitlisted: "We'll email you if a spot opens up.",
  rejected: "We couldn't offer you a spot this year. We hope to see you next time.",
};

const YEAR_LABELS: Record<string, string> = {
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  "5": "5th year+",
  "6": "Graduate",
};

const TEAM_LABELS: Record<string, string> = {
  solo: "Going solo",
  has_team: "Has a team",
  looking: "Looking for teammates",
};

export function applicantStatus(application: Pick<Application, "status" | "decision">): Status {
  return application.status === "draft" ? "draft" : (application.decision ?? "applied");
}

function StatusBadge({ status }: { status: Status }) {
  const [label, styles] = BADGES[status];
  return <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-sm font-medium ${styles}`}>{label}</span>;
}

// "2028-04-17" -> "April 2028", read as a plain date so no timezone shifts the month.
function monthYear(date: string | null): string | undefined {
  const match = date?.match(/^(\d{4})-(\d{2})/);
  if (!match) return date ?? undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type Step = { label: string; detail: string; state: "done" | "current" | "upcoming" };

function trackerSteps(application: Application, status: Status): Step[] {
  const submitted = application.submitted_at ? formatDay(application.submitted_at) : "";
  if (status === "draft") {
    return [
      { label: "Started", detail: "Answers saved", state: "done" },
      { label: "Submit", detail: "Waiting on you", state: "current" },
      { label: "Decision", detail: "By email", state: "upcoming" },
    ];
  }
  if (status === "applied") {
    return [
      { label: "Started", detail: "Answers saved", state: "done" },
      { label: "Submitted", detail: submitted, state: "done" },
      { label: "In review", detail: "Decision by email", state: "current" },
    ];
  }
  return [
    { label: "Started", detail: "Answers saved", state: "done" },
    { label: "Submitted", detail: submitted, state: "done" },
    { label: "Decision", detail: BADGES[status][0], state: "done" },
  ];
}

function Tracker({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Application progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.state === "done"
                  ? "bg-neutral-900 text-white"
                  : step.state === "current"
                    ? "border-2 border-amber-500 bg-amber-50 text-amber-900"
                    : "border border-neutral-300 text-neutral-400"
              }`}
              aria-hidden
            >
              {step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span className={`h-0.5 flex-1 rounded ${step.state === "done" ? "bg-neutral-900" : "bg-neutral-200"}`} aria-hidden />
            )}
          </div>
          <div>
            <p className={`text-sm font-semibold ${step.state === "upcoming" ? "text-neutral-400" : "text-neutral-900"}`}>
              {step.label}
              <span className="sr-only"> ({step.state === "done" ? "done" : step.state === "current" ? "current step" : "not yet"})</span>
            </p>
            {step.detail && <p className="text-xs text-neutral-500">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const outlineButton =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";

// Hacker-facing: where the application stands, what happens next, and their files.
export function ApplicationStatus({ application }: { application: Application }) {
  const status = applicantStatus(application);
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">HackHive 2027 application</p>
          <h3 className="mt-1 text-xl font-bold text-neutral-900">{HEADLINES[status]}</h3>
          <p className="mt-1 max-w-prose text-neutral-600">{NEXT_STEPS[status]}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-6 border-t border-neutral-100 pt-6">
        <Tracker steps={trackerSteps(application, status)} />
      </div>

      {(status === "draft" || application.resume_path || application.indemnification_path) && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-100 pt-6">
          {status === "draft" && (
            <Link
              href="/apply"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <PencilLine className="size-4" aria-hidden />
              Continue application
            </Link>
          )}
          {application.resume_path && (
            <a href="/dashboard/application/resume" target="_blank" rel="noreferrer" className={outlineButton}>
              <FileText className="size-4" aria-hidden />
              View resume
              <ExternalLink className="size-3.5 text-neutral-400" aria-hidden />
            </a>
          )}
          {application.indemnification_path && (
            <a href="/dashboard/application/indemnification" target="_blank" rel="noreferrer" className={outlineButton}>
              <FileSignature className="size-4" aria-hidden />
              View indemnification form
              <ExternalLink className="size-3.5 text-neutral-400" aria-hidden />
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere] text-neutral-900">{children}</dd>
    </div>
  );
}

function ExternalUrl({ url }: { url: string | null }) {
  if (!url) return null;
  // Only http(s) becomes a link; anything else stays plain text.
  if (!/^https?:\/\//i.test(url)) return <>{url}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900">
      {url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
    </a>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-100 py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h4 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h4>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function ApplicationDetails({ application }: { application: Application }) {
  const otherLinks = application.other_links ?? [];
  return (
    <div>
      <Group title="Personal">
        <Field label="Name">{[application.first_name, application.last_name].filter(Boolean).join(" ")}</Field>
        <Field label="Preferred name">{application.preferred_name}</Field>
        <Field label="Email">{application.email}</Field>
        <Field label="Phone">{application.phone}</Field>
        <Field label="Age">{application.age?.toString()}</Field>
        <Field label="Pronouns">{application.pronouns}</Field>
        <Field label="Location">{[application.city, application.country].filter(Boolean).join(", ")}</Field>
      </Group>

      <Group title="Education">
        <Field label="School Name">{application.university}</Field>
        <Field label="Program">{application.program}</Field>
        <Field label="Year of study">{application.year_of_study && (YEAR_LABELS[application.year_of_study] ?? application.year_of_study)}</Field>
        <Field label="Expected graduation">{monthYear(application.grad_date)}</Field>
      </Group>

      <Group title="Experience">
        <Field label="Hackathons attended">{application.hackathons_count?.toString()}</Field>
        <Field label="Resume">{application.resume_path ? "Uploaded" : undefined}</Field>
        <Field label="LinkedIn">{application.linkedin_url && <ExternalUrl url={application.linkedin_url} />}</Field>
        <Field label="GitHub">{application.github_url && <ExternalUrl url={application.github_url} />}</Field>
        <Field label="Portfolio">{application.portfolio_url && <ExternalUrl url={application.portfolio_url} />}</Field>
        <Field label="Other links">
          {otherLinks.length > 0 && (
            <ul className="space-y-0.5">
              {/* Keyed by position: older rows may hold the same link twice. */}
              {otherLinks.map((link, i) => (
                <li key={i}>
                  <ExternalUrl url={link} />
                </li>
              ))}
            </ul>
          )}
        </Field>
      </Group>

      <section className="border-t border-neutral-100 py-5">
        <h4 className="mb-3 text-sm font-semibold text-neutral-900">Short answers</h4>
        <dl className="space-y-4">
          <Field label="The project or work you're most proud of">
            <span className="whitespace-pre-wrap">{application.q_proud}</span>
          </Field>
          <Field label="A time you hacked something to your advantage">
            <span className="whitespace-pre-wrap">{application.q_hack}</span>
          </Field>
          <Field label="Anything else">
            {application.q_anything_else && <span className="whitespace-pre-wrap">{application.q_anything_else}</span>}
          </Field>
        </dl>
      </section>

      <Group title="Team & logistics">
        <Field label="Team status">{application.team_status && TEAM_LABELS[application.team_status]}</Field>
        <Field label="Teammates">{application.teammate_emails?.length ? application.teammate_emails.join(", ") : undefined}</Field>
        <Field label="T-shirt size">{application.tshirt_size}</Field>
        <Field label="Needs travel help">{application.needs_travel_help ? "Yes" : "No"}</Field>
        <Field label="Dietary restrictions">{application.dietary}</Field>
        <Field label="Accessibility needs">{application.accessibility}</Field>
      </Group>

      {(application.guardian_name || application.guardian_phone) && (
        <Group title="Guardian">
          <Field label="Name">{application.guardian_name}</Field>
          <Field label="Phone">{application.guardian_phone}</Field>
          <Field label="Relationship">{application.guardian_relationship}</Field>
        </Group>
      )}
    </div>
  );
}

// Hacker-facing: the full application, folded away under the status card.
export function ApplicationAnswers({ application }: { application: Application }) {
  return (
    <details className="group rounded-xl border border-neutral-200 bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
        Your application
        <ChevronDown className="size-5 text-neutral-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-neutral-100 px-6 py-5">
        <ApplicationDetails application={application} />
      </div>
    </details>
  );
}

// Admin-facing: status line plus everything they submitted.
export function ApplicationView({ application }: { application: Application }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-600">
          {application.submitted_at ? `Submitted ${formatDay(application.submitted_at)}` : "Not yet submitted"}
        </p>
        <StatusBadge status={applicantStatus(application)} />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <ApplicationDetails application={application} />
      </div>
    </div>
  );
}
