"use client";

import { useEffect, useRef } from "react";
import styles from "./SpeakersSection.module.css";

const CHARS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

type GavelRainProps = {
  /** Gavel centre as a fraction of the section: 0 = left/top, 1 = right/bottom */
  x?: number;
  y?: number;
  /** Overall brightness, lower is calmer behind the content */
  dim?: number;
};

export function GavelRain({ x = 0.5, y = 0.5, dim = 0.6 }: GavelRainProps) {
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

      // sound block
      const bx = cx + 14 * u;
      const by = cy + 36 * u;
      let gr = g.createLinearGradient(bx - 44 * u, 0, bx + 44 * u, 0);
      gr.addColorStop(0, "#222");
      gr.addColorStop(0.35, "#bbb");
      gr.addColorStop(0.6, "#777");
      gr.addColorStop(1, "#111");
      g.fillStyle = gr;
      g.fillRect(bx - 44 * u, by, 88 * u, 14 * u);
      g.beginPath();
      g.ellipse(bx, by + 14 * u, 44 * u, 11 * u, 0, 0, Math.PI);
      g.fill();
      g.fillStyle = "#d8d8d8";
      g.beginPath();
      g.ellipse(bx, by, 44 * u, 11 * u, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#555";
      g.lineWidth = 1.2 * u;
      g.beginPath();
      g.ellipse(bx, by, 36 * u, 8.5 * u, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.beginPath();
      g.ellipse(bx + 2 * u, by + 1 * u, 28 * u, 6 * u, 0, 0, Math.PI * 2);
      g.fill();

      // gavel (Shifted further left so it aligns above the sound block)
      g.save();
      g.translate(cx - 50 * u, cy - 30 * u);
      g.rotate((7 * Math.PI) / 6);
      gr = g.createLinearGradient(-4 * u, 0, 4 * u, 0);
      gr.addColorStop(0, "#333");
      gr.addColorStop(0.4, "#ddd");
      gr.addColorStop(1, "#222");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-3.6 * u, -10 * u);
      g.lineTo(3.6 * u, -10 * u);
      g.lineTo(2.5 * u, -85 * u);
      g.lineTo(-2.5 * u, -85 * u);
      g.closePath();
      g.fill();
      g.beginPath();
      g.ellipse(0, -87 * u, 5.5 * u, 4 * u, 0, 0, Math.PI * 2);
      g.fill();

      const hw = 30 * u;
      const hh = 13 * u;
      gr = g.createLinearGradient(0, -hh, 0, hh);
      gr.addColorStop(0, "#2a2a2a");
      gr.addColorStop(0.3, "#f2f2f2");
      gr.addColorStop(0.55, "#9a9a9a");
      gr.addColorStop(1, "#1a1a1a");
      g.fillStyle = gr;
      g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
      g.fillStyle = "#555";
      g.fillRect(-hw, -hh, 4 * u, 2 * hh);
      g.fillRect(hw - 4 * u, -hh, 4 * u, 2 * hh);
      g.fillStyle = gr;
      g.fillRect(-hw + 6 * u, -hh, 3 * u, 2 * hh);
      g.fillRect(hw - 9 * u, -hh, 3 * u, 2 * hh);
      g.fillStyle = "#444";
      g.beginPath();
      g.ellipse(-hw, 0, 3 * u, hh, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c8c8c8";
      g.beginPath();
      g.ellipse(hw, 0, 3 * u, hh, 0, 0, Math.PI * 2);
      g.fill();
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
      if (reduced) render(); // static gavel, no motion
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

  return <canvas ref={ref} className={styles.gavelRain} aria-hidden="true" />;
}