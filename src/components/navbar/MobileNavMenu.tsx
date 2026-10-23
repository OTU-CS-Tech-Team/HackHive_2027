"use client";

import Link from "next/link";
import styles from "./MobileNavMenu.module.css";

type NavLink = {
  href: string;
  label: string;
};

export default function MobileNavMenu({ links }: { links: readonly NavLink[] }) {
  return (
    <details className={`${styles.menu} md:hidden`}>
      <summary
        aria-label="Toggle navigation menu"
        aria-controls="mobile-page-navigation"
        className={styles.toggle}
      >
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </summary>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={(event) => event.currentTarget.parentElement?.removeAttribute("open")}
        className={styles.backdrop}
      />
      <nav
        id="mobile-page-navigation"
        aria-label="Page sections"
        className={styles.drawer}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={(event) => {
              const menu = event.currentTarget.closest<HTMLDetailsElement>("details");
              if (menu) menu.open = false;
            }}
            className={styles.link}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
