import Link from "next/link";
import styles from "./MobileNavMenu.module.css";

type NavLink = {
  href: string;
  label: string;
};

export default function MobileNavMenu({
  links,
  accountLinks = [],
}: {
  links: readonly NavLink[];
  accountLinks?: readonly NavLink[];
}) {
  return (
    <details data-mobile-menu className={`${styles.menu} lg:hidden`}>
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
        data-mobile-nav-close
        className={styles.backdrop}
      />
      <nav
        id="mobile-page-navigation"
        aria-label="Navigation menu"
        data-mobile-page-navigation
        className={styles.drawer}
      >
        <div className={styles.sectionLinks}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.link}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {accountLinks.length > 0 && (
          <div className={styles.accountLinks} role="group" aria-label="Account">
            {accountLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.link}>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </details>
  );
}
