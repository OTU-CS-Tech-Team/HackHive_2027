"use client";

/* eslint-disable @next/next/no-img-element -- fixed design art (cropped by CSS) and Storage avatars */
import { Press_Start_2P, VT323 } from "next/font/google";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { HEX_COUNT, hexesFilled, shortName } from "@/lib/passport";
import { CheckinQr } from "./CheckinQr";
import styles from "./passport.module.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel", display: "swap" });
const terminal = VT323({ weight: "400", subsets: ["latin"], variable: "--font-terminal", display: "swap" });

// A badge is an event the hacker was scanned into for points; id is the event id.
export type PassportBadge = { id: string; label: string };
export type PassportMission = { id: string; title: string; points: number; when: string };

// Quadrants of /passport/badges.png, in the order the design shows them.
const BADGE_ART = ["0 0", "100% 0", "100% 100%", "0 100%"];

// Decorative hex outlines: [file, width, height, centre x, centre y, rotation].
// Centres come from the Figma frame. Widths/heights are each SVG's own size.
type Deco = [string, number, number, number, number, number];

const CARD_DECOS: Deco[] = [
  ["polygon-1.svg", 50.8167, 58.4623, -4.2, -11.23, 35],
  ["polygon-2.svg", 30.7863, 35.4183, 1.34, 38.81, 64],
  ["polygon-4.svg", 21.5163, 24.7535, 317.44, -8.56, 129],
  ["polygon-3.svg", 50.8167, 58.4623, 360.78, -7.31, 12],
  ["polygon-15.svg", 105.195, 121.023, 35.14, 794.01, 20.6],
];

// Drawn over the card, so positioned against the whole frame.
const FRAME_DECOS: Deco[] = [
  ["polygon-4.svg", 21.5163, 24.7535, 391.44, 65.44, 129],
  ["polygon-16.svg", 76.503, 88.0133, 154.83, 845.74, 20.6],
  ["polygon-17.svg", 60.0747, 69.1132, 133.63, 768.55, 20.6],
  ["polygon-17.svg", 60.0747, 69.1132, 208.63, 785.55, 20.6],
];

// Honeycomb either side of the badges, relative to the status panel.
const COMB_DECOS: Deco[] = [
  ["comb-hex.svg", 28.5788, 32, 19, 224.5, -90],
  ["comb-hex.svg", 28.5788, 32, 19, 257.5, -90],
  ["comb-half.svg", 23.5596, 32, 19, 288, -90],
  ["comb-hex.svg", 28.5788, 32, 48, 240.5, -90],
  ["comb-hex-alt.svg", 28.5788, 32, 48, 273.5, -90],
  ["comb-hex.svg", 28.5788, 32, 303, 227.5, -90],
  ["comb-hex.svg", 28.5788, 32, 303, 260.5, -90],
  ["comb-hex.svg", 28.5788, 32, 273, 243.5, -90],
  ["comb-hex.svg", 28.5788, 32, 273, 276.5, -90],
  ["comb-half.svg", 23.5596, 32, 303, 291, -90],
];

function Decos({ items }: { items: Deco[] }) {
  return items.map(([file, width, height, x, y, deg], i) => (
    <img
      key={i}
      className={styles.deco}
      src={`/passport/${file}`}
      alt=""
      style={{ left: x - width / 2, top: y - height / 2, rotate: `${deg}deg` }}
    />
  ));
}

// Locked slots show the art of the badge that fills them next, dimmed.
function BadgeArt({ index, badge, className }: { index: number; badge?: PassportBadge; className: string }) {
  return (
    <span
      role="img"
      aria-label={badge ? `Badge: ${badge.label}` : "Locked badge"}
      className={`${styles.badge} ${badge ? "" : styles.locked} ${className}`}
      style={{ backgroundPosition: BADGE_ART[index % BADGE_ART.length] }}
    />
  );
}

// No photo, or one that won't load, falls back to the design's placeholder.
function Avatar({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  const photo = src && !failed;
  return (
    <img
      className={`${styles.avatar} ${photo ? styles.photo : ""}`}
      src={photo ? src : "/passport/avatar-placeholder.png"}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

// Native modal: Escape, focus trapping and the backdrop come free. The inner
// div fills the box, so a click that lands on the dialog itself was on the backdrop.
function Popup({ dialogRef, title, className, children }: { dialogRef: RefObject<HTMLDialogElement | null>; title: string; className: string; children: ReactNode }) {
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className={`${styles.dialog} ${className}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={styles.popupInner}>
        <form method="dialog">
          <button className={`${styles.close} ${styles.press}`}>Close</button>
        </form>
        {children}
      </div>
    </dialog>
  );
}

export function Passport({
  fullName,
  avatarUrl,
  points,
  badges,
  missions,
  initialQrDataUrl,
}: {
  fullName: string | null;
  avatarUrl: string | null;
  points: number;
  badges: PassportBadge[];
  missions: PassportMission[];
  initialQrDataUrl: string;
}) {
  const qrRef = useRef<HTMLDialogElement>(null);
  const missionsRef = useRef<HTMLDialogElement>(null);
  const socialsRef = useRef<HTMLDialogElement>(null);

  const filled = hexesFilled(points);
  const badgeIndex = new Map(badges.map((badge, i) => [badge.id, i]));
  // The three most recent badges, oldest first; empty slots stay locked.
  const first = Math.max(0, badges.length - 3);
  const shown = [first, first + 1, first + 2];

  return (
    <div className={`${pixel.variable} ${terminal.variable} ${styles.wrap}`}>
      <div className={styles.stage}>
        <article className={styles.card} aria-label="HackHive passport">
          <Decos items={CARD_DECOS} />
          <img className={styles.logo} src="/passport/hackhive-logo.png" alt="HackHive" />

          <div className={styles.badgeBox}>
            {/* The first badge earned, as in the design. */}
            <BadgeArt index={0} badge={badges[0]} className={styles.badgeLarge} />
          </div>

          <header className={styles.header}>
            <h2 className={styles.headerTitle}>Hacker Profile</h2>
            <p className={styles.name}>{shortName(fullName)}</p>
            <img className={styles.hexFrame} src="/passport/hex-pfp.svg" alt="" />
            <Avatar src={avatarUrl} />
          </header>

          <section className={styles.status} aria-labelledby="hive-status">
            <img className={`${styles.statusLine} ${styles.statusLineLeft}`} src="/passport/line-short.svg" alt="" />
            <h3 id="hive-status" className={styles.statusTitle}>Your Hive Status</h3>
            <img className={`${styles.statusLine} ${styles.statusLineRight}`} src="/passport/line-short.svg" alt="" />
            <p className={styles.points}>
              <span className={styles.pointsValue}>{points}</span>
              <span className={styles.pointsUnit}>PTS</span>
            </p>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Hive progress"
              aria-valuemin={0}
              aria-valuemax={HEX_COUNT}
              aria-valuenow={filled}
              aria-valuetext={`${filled} of ${HEX_COUNT} cells lit`}
            >
              {Array.from({ length: HEX_COUNT }, (_, i) => (
                <img key={i} src={i < filled ? "/passport/points-full.svg" : "/passport/points-empty.svg"} alt="" />
              ))}
            </div>
            <img className={styles.divider} src="/passport/line-long.svg" alt="" />
            <p className={styles.badgeCount}>
              {badges.length} {badges.length === 1 ? "Badge" : "Badges"} Found
            </p>
            <Decos items={COMB_DECOS} />
            <ul className={styles.badgeRow}>
              {shown.map((i) => (
                <li key={i}>
                  <BadgeArt index={i} badge={badges[i]} className={styles.badgeSmall} />
                </li>
              ))}
            </ul>
          </section>

          <button type="button" className={`${styles.scan} ${styles.press}`} onClick={() => qrRef.current?.showModal()}>
            <img className={styles.centered} src="/passport/scanner-button.svg" alt="" />
            <span className={styles.scanIcon}>
              <img src="/passport/scanner-icon.png" alt="" />
            </span>
            <img className={styles.scanDivider} src="/passport/scanner-divider.svg" alt="" />
            <span className={styles.scanLabel}>SCAN HIVE BADGE</span>
          </button>

          <button type="button" className={`${styles.missions} ${styles.press}`} onClick={() => missionsRef.current?.showModal()}>
            <img className={styles.centered} src="/passport/missions-button.svg" alt="" />
            <img className={styles.missionsLogo} src="/passport/missions-logo.svg" alt="" />
            <img className={styles.missionsDivider} src="/passport/missions-divider.svg" alt="" />
            <span className={styles.missionsLabel}>MISSIONS</span>
          </button>

          <button type="button" className={`${styles.club} ${styles.press}`} aria-label="Connect with the OTU CS Club" onClick={() => socialsRef.current?.showModal()}>
            <img src="/passport/cs-club-button.png" alt="" />
          </button>
        </article>
        <Decos items={FRAME_DECOS} />
      </div>

      <Popup dialogRef={qrRef} title="Your hive badge" className={styles.popup}>
        <div className={styles.qrBody}>
          <h2 className={styles.popupTitle}>Your Hive Badge</h2>
          <div className={styles.qr}>
            <CheckinQr initialQrDataUrl={initialQrDataUrl} />
          </div>
          <p className={styles.qrCaption}>Show this at check-in, events, and the help desk to earn badges and points.</p>
        </div>
      </Popup>

      <Popup dialogRef={missionsRef} title="Mission log" className={styles.missionLog}>
        <h2 className={styles.missionLogTitle}>MISSION LOG</h2>
        <p className={styles.objectives}>ACTIVE OBJECTIVES</p>
        <div className={styles.missionScroll}>
          {missions.length ? (
            <ol className={styles.missionList}>
              {missions.map((mission) => {
                const earned = badgeIndex.get(mission.id);
                return (
                  <li key={mission.id} className={styles.mission}>
                    <img className={styles.missionFrame} src="/passport/mission.png" alt="" loading="lazy" />
                    {earned !== undefined && <BadgeArt index={earned} badge={badges[earned]} className={styles.missionBadge} />}
                    <span className={styles.missionText}>
                      <span className={`${styles.missionTitle} ${earned !== undefined ? styles.missionDone : ""}`}>{mission.title}</span>
                      <span className={styles.missionMeta}>
                        +{mission.points} PTS · {earned !== undefined ? "COMPLETE" : mission.when}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.missionEmpty}>No missions yet. Events worth points show up here closer to HackHive.</p>
          )}
        </div>
      </Popup>

      <Popup dialogRef={socialsRef} title="Connect with the OTU CS Club" className={`${styles.popup} ${styles.socials}`}>
        <h2 className={styles.socialTitle}>Connect with us!</h2>
        <p className={styles.handle}>@otu.csclub</p>
        <a className={`${styles.instagram} ${styles.press}`} href="https://www.instagram.com/otu.csclub/" target="_blank" rel="noreferrer" aria-label="Instagram">
          <img src="/passport/instagram.png" alt="" loading="lazy" />
        </a>
        <a className={`${styles.tiktok} ${styles.press}`} href="https://www.tiktok.com/@otu.csclub" target="_blank" rel="noreferrer" aria-label="TikTok">
          <img src="/passport/tiktok.png" alt="" loading="lazy" />
        </a>
        <p className={styles.websiteCaption}>Our Official Website</p>
        <a className={`${styles.linkedin} ${styles.press}`} href="https://www.linkedin.com/company/otu-cs-club/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <img src="/passport/linkedin.png" alt="" loading="lazy" />
        </a>
        <a className={`${styles.website} ${styles.press}`} href="https://www.otucsclub.dev/" target="_blank" rel="noreferrer" aria-label="OTU CS Club website">
          <img src="/passport/cs-club-website.png" alt="" loading="lazy" />
        </a>
      </Popup>
    </div>
  );
}
