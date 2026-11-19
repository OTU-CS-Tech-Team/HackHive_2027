import { FLAG_LABELS, type HiveFlag } from "@/lib/hive/flags";
import { MAX_TOTAL } from "@/lib/hive/tier";
import type { BlindCard } from "@/lib/review/blind";
import { formatApplicantNo } from "@/lib/review/pools";
import { TierBadge } from "../hive/TierBadge";

// Server component: renders only what's in the BlindCard (already scrubbed).

const pill = "inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300 ring-inset";

export function BlindCardView({ card }: { card: BlindCard }) {
  return (
    <article aria-labelledby="applicant-heading" className="space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 id="applicant-heading" className="text-xl font-bold tabular-nums">
          Applicant {formatApplicantNo(card.applicantNo)}
        </h2>
        <TierBadge tier={card.tier} overridden={card.movedTier} />
        {card.scores && (
          <span className="text-sm font-semibold tabular-nums">
            {card.scores.total}/{MAX_TOTAL}
          </span>
        )}
      </header>

      {card.flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.flags.map((flag) => (
            <span key={flag} className={pill}>
              {FLAG_LABELS[flag as HiveFlag] ?? flag}
            </span>
          ))}
        </div>
      )}

      <section aria-label="Short answers" className="space-y-4">
        {card.answers.map(({ question, text }) => (
          <div key={question}>
            <h3 className="text-sm font-semibold text-neutral-700">{question}</h3>
            <p className="mt-1 text-base break-words whitespace-pre-wrap">{text || <span className="text-neutral-500">No answer.</span>}</p>
          </div>
        ))}
        <p className="text-sm text-neutral-700">
          <span className="font-semibold">Hackathons before:</span> <span className="tabular-nums">{card.hackathons ?? "Not given"}</span>
        </p>
      </section>

      <section aria-label="Hive Mind" className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <h3 className="font-semibold">
          Hive Mind <span className="text-sm font-normal text-neutral-600">(suggestion only)</span>
        </h3>
        {card.scores ? (
          <p className="mt-2 text-sm tabular-nums">
            <strong>
              Total {card.scores.total}/{MAX_TOTAL}
            </strong>{" "}
            · Experience {card.scores.experience}/5 · Creativity {card.scores.creativity}/5 · Quality {card.scores.quality}/5
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">No scores.</p>
        )}
        {card.rationale && <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-neutral-800">{card.rationale}</blockquote>}
      </section>

      <details className="group rounded-lg border border-neutral-200">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          <span className="group-open:hidden">Show resume</span>
          <span className="hidden group-open:inline">Hide resume</span>
        </summary>
        <div className="border-t border-neutral-200 p-4">
          {card.resume.status === "ok" && (
            <>
              <p className="mb-3 text-xs text-neutral-600">Cleaned text: education, names, schools, contact details and links are removed.</p>
              <pre className="font-sans text-sm break-words whitespace-pre-wrap">{card.resume.text}</pre>
            </>
          )}
          {card.resume.status === "none" && <p className="text-sm text-neutral-600">No resume uploaded.</p>}
          {card.resume.status === "failed" && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">Resume couldn&apos;t be anonymized, this will show their name/school.</p>
              <p className="mt-1">{card.resume.reason}</p>
              <a
                href={`/admin/review/resume/${card.applicantNo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                Open the original resume
              </a>
            </div>
          )}
        </div>
      </details>
    </article>
  );
}
