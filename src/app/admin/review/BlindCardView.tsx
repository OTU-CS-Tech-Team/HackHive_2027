import { FLAG_LABELS, type HiveFlag } from "@/lib/hive/flags";
import { MAX_TOTAL } from "@/lib/hive/tier";
import type { BlindCard } from "@/lib/review/blind";
import { formatApplicantNo } from "@/lib/review/pools";
import { isDateLine } from "@/lib/review/resume-text";
import { TierBadge } from "../hive/TierBadge";

// Server components: render only what's in the BlindCard. The queue page lays
// them out as a reading column (answers, resume) and a side rail (the facts a
// reviewer decides with), next to the vote buttons.

const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)";

/** The applicant number, scores and flags: what sits beside the vote buttons. */
export function BlindFacts({ card }: { card: BlindCard }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {/* The one decorative element: a hive cell holding the applicant number. */}
        <div className="grid h-20 w-[5.75rem] shrink-0 place-items-center bg-hive-honey" style={{ clipPath: HEX }} aria-hidden>
          <div className="grid h-[4.5rem] w-[5.25rem] place-items-center bg-hive-honey-soft" style={{ clipPath: HEX }}>
            <span className="font-display text-xl font-bold text-hive-ink tabular-nums">{formatApplicantNo(card.applicantNo)}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <h2 id="applicant-heading" className="sr-only">
            Applicant {formatApplicantNo(card.applicantNo)}
          </h2>
          <TierBadge tier={card.tier} overridden={card.movedTier} />
          {card.scores && (
            <p className="font-display text-3xl leading-none font-bold text-hive-ink tabular-nums">
              {card.scores.total}
              <span className="text-base font-medium text-hive-muted">/{MAX_TOTAL}</span>
            </p>
          )}
        </div>
      </div>

      {card.scores ? (
        <dl className="space-y-2">
          <Meter label="Experience" value={card.scores.experience} />
          <Meter label="Creativity" value={card.scores.creativity} />
          <Meter label="Quality" value={card.scores.quality} />
        </dl>
      ) : (
        <p className="text-sm text-hive-muted">The Hive Mind hasn&apos;t scored this one.</p>
      )}

      <p className="flex items-baseline justify-between border-t border-hive-line pt-3 text-sm">
        <span className="text-hive-muted">Hackathons before</span>
        <span className="font-semibold text-hive-ink tabular-nums">{card.hackathons ?? "Not given"}</span>
      </p>

      {card.flags.length > 0 && (
        <ul aria-label="Flags" className="flex flex-wrap gap-1.5">
          {card.flags.map((flag) => (
            <li
              key={flag}
              className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300 ring-inset"
            >
              {FLAG_LABELS[flag as HiveFlag] ?? flag}
            </li>
          ))}
        </ul>
      )}

      {card.rationale && (
        <figure className="rounded-lg bg-hive-panel p-3 ring-1 ring-hive-line">
          <figcaption className="text-xs font-semibold text-hive-muted">Why the Hive Mind scored it this way</figcaption>
          <blockquote className="mt-1 text-sm leading-relaxed text-hive-ink">{card.rationale}</blockquote>
        </figure>
      )}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-24 text-sm text-hive-muted">{label}</dt>
      <dd className="flex flex-1 items-center gap-2">
        <span className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4, 5].map((step) => (
            <span key={step} className={`h-2 flex-1 rounded-full ${step <= value ? "bg-hive-honey" : "bg-hive-line"}`} />
          ))}
        </span>
        <span className="w-8 text-right text-sm font-semibold text-hive-ink tabular-nums">
          {value}
          <span className="sr-only"> out of 5</span>
        </span>
      </dd>
    </div>
  );
}

/** The short answers and the resume: the part a reviewer actually reads. */
export function BlindReading({ card }: { card: BlindCard }) {
  return (
    <article aria-labelledby="applicant-heading" className="space-y-8">
      {card.answers.map(({ question, text }) => (
        <section key={question}>
          <h3 className="font-display text-base font-semibold text-hive-ink">{question}</h3>
          {text ? (
            <p className="mt-2 max-w-prose text-[1.0625rem] leading-[1.75] break-words whitespace-pre-wrap text-neutral-800">{text}</p>
          ) : (
            <p className="mt-2 text-sm text-hive-muted">No answer.</p>
          )}
        </section>
      ))}

      <details className="group border-t border-hive-line pt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md font-display text-base font-semibold text-hive-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
          <span aria-hidden className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
            ▸
          </span>
          <span className="group-open:hidden">View resume</span>
          <span className="hidden group-open:inline">Hide resume</span>
        </summary>
        <div className="mt-3">
          {card.resume.status === "ok" && (
            <div className="space-y-6">
              {(
                [
                  ["Experience", card.resume.experience],
                  ["Projects", card.resume.projects],
                ] as const
              ).map(([title, entries]) => (
                <section key={title} aria-label={title}>
                  <h4 className="text-sm font-semibold text-hive-muted">{title}</h4>
                  {entries.length ? (
                    <ul className="mt-3 space-y-5">
                      {entries.map(([heading, ...rest], i) => {
                        const dates = rest.filter(isDateLine);
                        const details = rest.filter((line) => !isDateLine(line));
                        return (
                          <li key={i} className="max-w-prose border-l-2 border-hive-honey pl-4 break-words">
                            <p className="font-display font-semibold text-hive-ink">{heading}</p>
                            {dates.length > 0 && <p className="text-sm text-hive-muted">{dates.join(", ")}</p>}
                            {details.length > 0 && (
                              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.9375rem] leading-relaxed text-neutral-800 marker:text-hive-honey">
                                {details.map((line, j) => (
                                  <li key={j}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-hive-muted">None listed.</p>
                  )}
                </section>
              ))}
              <p className="text-xs text-hive-muted">Only the Experience and Projects sections are shown.</p>
            </div>
          )}
          {card.resume.status === "none" && <p className="text-sm text-hive-muted">No resume uploaded.</p>}
          {card.resume.status === "failed" && (
            <div role="alert" className="max-w-prose rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
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
