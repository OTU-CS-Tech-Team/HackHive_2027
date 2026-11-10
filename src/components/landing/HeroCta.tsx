import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ctaClassName =
  "mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-[#f5b83d] px-8 text-[1.05rem] font-bold text-[#231c10] shadow-[0_12px_28px_rgba(90,50,8,0.2)] transition-[background-color,transform] duration-200 hover:bg-[#ffd36a] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#231c10] motion-reduce:transition-none";

export async function HeroCta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Link href="/apply" className={ctaClassName}>
        My Application
      </Link>
    );
  }

  return (
    <Link href="/signup" className={ctaClassName}>
      Apply now!
    </Link>
  );
}

export function HeroCtaFallback() {
  return (
    <Link href="/signup" className={ctaClassName}>
      Apply now!
    </Link>
  );
}
