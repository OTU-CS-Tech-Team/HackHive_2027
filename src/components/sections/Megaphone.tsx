"use client";

import styles from "./Megaphone.module.css";

type MegaphoneBannerProps = {
  icon?: "megaphone" | "hammer-gavel";
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
};

export function MegaphoneBanner({
  icon = "megaphone",
  title = "Important Announcement",
  subtitle = "Check out the latest updates and schedule details for this year's speakers and events.",
  ctaText = "View Schedule",
  ctaHref = "#speakers",
}: MegaphoneBannerProps) {
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.megaphoneCard}>
        <div className={styles.iconWrapper} aria-hidden="true">
          {icon === "hammer-gavel" ? (
            <svg
              className={styles.megaphoneSvg}
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 35 29 19" />
              <path d="m23 15 8-8 11 11-8 8z" />
              <path d="M25 41h18" />
            </svg>
          ) : (
            <>
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
            </>
          )}
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

import { useEffect, useRef } from "react";

const CHARS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

type MegaphoneRainProps = {
  /** Megaphone centre as a fraction of the section: 0 = left/top, 1 = right/bottom */
  x?: number;
  y?: number;
  /** Overall brightness, lower is calmer behind the content */
  dim?: number;
};

export function MegaphoneRain({ x = 0.5, y = 0.5, dim = 0.6 }: MegaphoneRainProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const section = cv?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!cv || !section || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, fs = 14, cw = 10, cols = 0, rows = 0;
    let mask = new Float32Array(0);
    let trail = new Float32Array(0);
    let chars = new Uint8Array(0);
    let drops: { y: number; v: number }[] = [];
    let running = true;
    let raf = 0;
    let last = 0;

    function buildMask() {
      const o = document.createElement("canvas");
      o.width = W;
      o.height = H;
      const g = o.getContext("2d");
      if (!g) return;
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);

      const u = Math.min(W * 0.8, 900) / 110;
      const cx = W * x;
      const cy = H * y;

      // megaphone, drawn along its own axis then rotated to point up and right
      g.save();
      g.translate(cx - 8 * u, cy + 4 * u);
      g.rotate(-Math.PI / 9);

      const shade = (y0: number, y1: number) => {
        const sg2 = g.createLinearGradient(0, y0, 0, y1);
        sg2.addColorStop(0, "#222");
        sg2.addColorStop(0.3, "#f0f0f0");
        sg2.addColorStop(0.55, "#999");
        sg2.addColorStop(1, "#181818");
        return sg2;
      };

      // handle (behind the body)
      let gr = g.createLinearGradient(-24 * u, 0, -12 * u, 0);
      gr.addColorStop(0, "#222");
      gr.addColorStop(0.4, "#d0d0d0");
      gr.addColorStop(1, "#1c1c1c");
      g.fillStyle = gr;
      g.fillRect(-24 * u, 6 * u, 12 * u, 28 * u);
      g.beginPath();
      g.ellipse(-18 * u, 34 * u, 6 * u, 3 * u, 0, 0, Math.PI * 2);
      g.fill();
      // trigger
      g.fillStyle = "#9a9a9a";
      g.fillRect(-11 * u, 10 * u, 5 * u, 8 * u);

      // neck
      g.fillStyle = shade(-10 * u, 10 * u);
      g.fillRect(-30 * u, -10 * u, 26 * u, 20 * u);

      // mouthpiece ring
      g.fillStyle = "#555";
      g.fillRect(-37 * u, -12 * u, 7 * u, 24 * u);
      g.fillStyle = "#cfcfcf";
      g.beginPath();
      g.ellipse(-37 * u, 0, 3 * u, 12 * u, 0, 0, Math.PI * 2);
      g.fill();

      // bell (cone)
      g.fillStyle = shade(-30 * u, 30 * u);
      g.beginPath();
      g.moveTo(-5 * u, -10 * u);
      g.lineTo(45 * u, -30 * u);
      g.lineTo(45 * u, 30 * u);
      g.lineTo(-5 * u, 10 * u);
      g.closePath();
      g.fill();

      // dark band around the bell
      g.fillStyle = "rgba(20,20,20,0.85)";
      g.beginPath();
      g.moveTo(17 * u, -19 * u);
      g.lineTo(23 * u, -21.5 * u);
      g.lineTo(23 * u, 21.5 * u);
      g.lineTo(17 * u, 19 * u);
      g.closePath();
      g.fill();

      // rim and opening
      g.fillStyle = "#e2e2e2";
      g.beginPath();
      g.ellipse(45 * u, 0, 7 * u, 30 * u, 0, 0, Math.PI * 2);
      g.fill();
      gr = g.createLinearGradient(40 * u, 0, 50 * u, 0);
      gr.addColorStop(0, "#050505");
      gr.addColorStop(1, "#4a4a4a");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(45 * u, 0, 5 * u, 26 * u, 0, 0, Math.PI * 2);
      g.fill();

      // sound waves leaving the bell
      g.strokeStyle = "#bdbdbd";
      g.lineCap = "round";
      [58, 70, 82].forEach((rx, n) => {
        g.globalAlpha = 0.9 - n * 0.22;
        g.lineWidth = (3 - n * 0.5) * u;
        g.beginPath();
        g.arc(45 * u, 0, (rx - 45) * u + 18 * u, -0.7, 0.7);
        g.stroke();
      });
      g.globalAlpha = 1;
      g.restore();

      const s = document.createElement("canvas");
      s.width = cols;
      s.height = rows;
      const sg = s.getContext("2d");
      if (!sg) return;
      sg.drawImage(o, 0, 0, cols, rows);
      const d = sg.getImageData(0, 0, cols, rows).data;
      mask = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        mask[i] = Math.min(1, Math.pow(d[i * 4] / 170, 0.7));
      }
    }

    function render() {
      if (!cols) return;
      ctx!.clearRect(0, 0, W, H);

      // Only draw rows currently on screen: the section can be very tall.
      const rect = section!.getBoundingClientRect();
      const r0 = Math.max(0, Math.floor(-rect.top / fs) - 1);
      const r1 = Math.min(rows, Math.ceil((window.innerHeight - rect.top) / fs) + 1);

      for (let r = r0; r < r1; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const b = trail[i];
          const m = mask[i];
          if (!reduced && Math.random() < 0.02) {
            chars[i] = (Math.random() * CHARS.length) | 0;
          }
          const bb = Math.min(1, b);
          const a =
            Math.max(bb * 0.16, Math.min(1, m * 1.3) * (0.6 + 0.4 * bb)) * dim;
          if (a < 0.03) {
            trail[i] *= 0.93;
            continue;
          }
          if (b > 1.2) {
            ctx!.fillStyle = `rgba(210,255,220,${Math.min(1, (0.5 + m * 0.5) * dim + 0.1)})`;
          } else {
            const gv = (150 + a * 105) | 0;
            ctx!.fillStyle = `rgba(${m > 0.8 && bb > 0.3 ? 120 : 0},${gv},${60 + ((m * 60) | 0)},${Math.min(1, a * 1.15)})`;
          }
          ctx!.fillText(CHARS[chars[i]], c * cw, r * fs);
          trail[i] = b * 0.93;
        }
      }
    }

    function setup() {
      W = section!.clientWidth;
      H = section!.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv!.width = W * dpr;
      cv!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      fs = Math.max(11, Math.min(16, Math.round(W / 90)));
      cw = fs * 0.75;
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / fs);
      trail = new Float32Array(cols * rows);
      chars = new Uint8Array(cols * rows);
      for (let i = 0; i < chars.length; i++) {
        chars[i] = (Math.random() * CHARS.length) | 0;
      }
      drops = Array.from({ length: cols }, () => ({
        y: -Math.random() * rows,
        v: 0.35 + Math.random() * 0.7,
      }));
      buildMask();
      ctx!.font = `${fs}px monospace`;
      ctx!.textBaseline = "top";
      if (reduced) render(); // static megaphone, no motion
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (reduced || !running || !cols || t - last < 33) return;
      last = t;

      for (let c = 0; c < cols; c++) {
        const d = drops[c];
        const prev = d.y | 0;
        d.y += d.v;
        const cur = d.y | 0;
        for (let r = prev + 1; r <= cur; r++) {
          if (r >= 0 && r < rows) trail[r * cols + c] = 1.5;
        }
        if (d.y > rows + 6 + Math.random() * 10) {
          d.y = -Math.random() * rows * 0.6;
          d.v = 0.35 + Math.random() * 0.7;
        }
      }
      render();
    }

    const resizeObserver = new ResizeObserver(setup);
    resizeObserver.observe(section);
    const visibilityObserver = new IntersectionObserver((entries) => {
      running = entries[0].isIntersecting;
    });
    visibilityObserver.observe(section);

    setup();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [x, y, dim]);

  return <canvas ref={ref} className={styles.megaphoneRain} aria-hidden="true" />;
}