"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavbarShell.module.css";

export default function NavbarFrame({ children }: { children: React.ReactNode }) {
  const museum = usePathname() === "/hackhive/archive";
  if (museum) return <header data-navbar-shell data-hidden="false" className={styles.museumHeader}>
    <Link href="/" className={styles.museumHome}>HackHive<span aria-hidden="true">✳</span></Link>
    <span className={styles.museumLabel}>THE ARCHIVE / 2024—2026</span>
    <Link href="/" className={styles.museumBack}>Back to Earth <span aria-hidden="true">↗</span></Link>
  </header>;
  return <header data-navbar-shell data-hidden="false" className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between bg-white px-4 sm:px-6 ${styles.header}`}>
    {children}
  </header>;
}
