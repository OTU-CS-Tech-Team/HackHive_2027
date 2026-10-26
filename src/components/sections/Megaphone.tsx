"use client";

import styles from "./Megaphone.module.css";

type MegaphoneBannerProps = {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
};

export function MegaphoneBanner({
  title = "Important Announcement",
  subtitle = "Check out the latest updates and schedule details for this year's speakers and events.",
  ctaText = "View Schedule",
  ctaHref = "#speakers",
}: MegaphoneBannerProps) {
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.megaphoneCard}>
        {/* Megaphone Graphic Icon */}
        <div className={styles.iconWrapper} aria-hidden="true">
          <svg
            className={styles.megaphoneSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11l18-5v12L3 13v-2z" />
            <path d="M11.6 16.8a3 3 0 1 1-4.2-4.2" />
            <path d="M6 9a3 3 0 0 1 3-3" />
            <path d="M19 10v4" />
          </svg>
          <div className={styles.soundWaves}>
            <span className={styles.wave1} />
            <span className={styles.wave2} />
            <span className={styles.wave3} />
          </div>
        </div>

        {/* Text Content */}
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {/* Optional Call to Action */}
        {ctaHref && (
          <a href={ctaHref} className={styles.ctaButton}>
            {ctaText} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </div>
  );
}