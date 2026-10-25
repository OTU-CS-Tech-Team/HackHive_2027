import Link from "next/link";
import { Suspense } from "react";
import { FaqSection } from "@/components/sections/FaqSection";
import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";
import { TeamSection } from "@/components/sections/teamSection";
import { createClient } from "@/lib/supabase/server";

async function HeroCTA() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSignedIn = !!user;

  if (isSignedIn) {
    return (
      <Link
        href="/apply"
        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
      >
        My Application
      </Link>
    );
  }

  return (
    <Link
      href="/signup"
      className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
    >
      Sign up as a hacker
    </Link>
  );
}

function HeroCTAFallback() {
  return (
    <Link
      href="/signup"
      className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
    >
      Sign up as a hacker
    </Link>
  );
}

export default function Home() {
  return (
    <main>
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 pt-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          HackHive 2027
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-neutral-600">
          Join Ontario Tech University&apos;s premier hackathon. Build, learn, and connect with
          fellow hackers from across the globe.
        </p>
        <Suspense fallback={<HeroCTAFallback />}>
          <HeroCTA />
        </Suspense>
      </section>
      <SpeakersSection />
      <SponsorsSection />
      <HackHive2025Section />
      <FaqSection />
      <TeamSection />
    </main>
  );
}
