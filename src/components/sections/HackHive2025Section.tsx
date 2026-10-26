import Link from "next/link";
import { ARCHIVE_YEARS } from "@/data/hackhive";

export function HackHive2025Section() {
  return (
    <section
      id="hackhive-2025"
      aria-labelledby="museum-heading"
      className="scroll-mt-16 border-y border-[#e3d7bb] bg-[#faf8f1] px-6 py-12 sm:px-12 sm:py-16"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#82550f]">
            {[...ARCHIVE_YEARS].sort((a, b) => a - b).join(" · ")}
          </p>
          <h2
            id="museum-heading"
            className="max-w-2xl text-3xl font-bold tracking-tight text-[#231c10] sm:text-4xl"
          >
            HackHive, through the years
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#685e4b]">
            Explore the projects built by past HackHive teams. Watch their demos
            and revisit the ideas that started here.
          </p>
          <Link
            href="/hackhive/archive"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-4 rounded-lg bg-[#f5b83d] px-5 py-3 text-sm font-semibold text-[#231c10] transition-colors hover:bg-[#ffd879] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#82550f] motion-reduce:transition-none"
          >
            Visit the HackHive Museum <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
