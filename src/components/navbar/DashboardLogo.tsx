"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function DashboardLogo() {
  const pathname = usePathname();
  if (!pathname.startsWith("/dashboard")) return null;

  return (
    <Link
      href="/"
      aria-label="HackHive home"
      className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hive-ink"
    >
      <Image
        src="/Images/Hackhivelogo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="h-9 w-auto shrink-0 sm:h-10"
      />
      <span className="hidden text-lg font-bold tracking-tight text-neutral-900 sm:inline">HackHive</span>
    </Link>
  );
}