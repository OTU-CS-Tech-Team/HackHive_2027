import Link from "next/link";
import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { HeroScene } from "./HeroScene";
import styles from "./HeroSection.module.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: "500",
});

async function HeroCTA() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Link href="/apply" className={styles.primary}>
        My Application
      </Link>
    );
  }

  return (
    <Link href="/signup" className={styles.primary}>
      Join as a hacker <span aria-hidden="true">→</span>
    </Link>
  );
}

function HeroCTAFallback() {
  return (
    <Link href="/signup" className={styles.primary}>
      Join as a hacker <span aria-hidden="true">→</span>
    </Link>
  );
}

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hackhive-hero-title">
      <HeroScene />
      <div className={styles.copy}>
        <p className={styles.eyebrow}>OTU CS Club · In-person hackathon</p>
        <h1 id="hackhive-hero-title" className={`${styles.title} ${display.className}`}>
          HackHive
          <span>2027</span>
        </h1>
        <p className={styles.when}>Jan 29–31, 2027 · Ontario Tech University</p>
        <div className={styles.actions}>
          <Suspense fallback={<HeroCTAFallback />}>
            <HeroCTA />
          </Suspense>
          <a className={styles.secondary} href="#judges">
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}
