import Link from "next/link";
import { ARCHIVE_YEARS } from "@/data/hackhive";

export function HackHive2025Section() {
  return (
    <section
      id="hackhive-2025"
      aria-labelledby="museum-heading"
      className="flex min-h-[60vh] scroll-mt-16 items-center border-y border-neutral-200 bg-[#fff8f2] px-6 py-20 sm:px-12"
    >
      <div className="mx-auto w-full max-w-5xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#7a4961]">
          {[...ARCHIVE_YEARS].sort((a, b) => a - b).join(" · ")}
        </p>
        <h2
          id="museum-heading"
          className="max-w-2xl text-3xl font-bold tracking-tight text-[#1b003f] sm:text-5xl"
        >
          HackHive, through the years
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
          Explore the projects and ideas built by past HackHive teams. Visit the
          museum for winning projects, demos, and a look back at every year.
        </p>
        <Link
          href="/hackhive/archive"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#1b003f] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#3a2058] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1b003f]"
        >
          Visit the HackHive Museum <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
