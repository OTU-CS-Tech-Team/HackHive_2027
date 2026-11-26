"use client";

import { useEffect } from "react";
import { PCBBackground } from "@/lib/pcb-background";

// Full-page animated circuit board. PCBBackground adds its own fixed canvas to <body>
// (z-index -1, behind all content, clicks pass through), so this renders nothing itself.
export function PcbBackdrop() {
  useEffect(() => {
    const bg = new PCBBackground(document.body, {
      traceWidth: 3.5, // thicker copper (default 2)
      cell: 16,        // slightly bigger routing grid so the fatter traces keep their spacing
      colors: {
        board: "#0f2c24",         // brighter base (default #07130f)
        trace: "#16805f",
        traceHighlight: "#3cc79b",
        pad: "#1ca67c",
        chip: "#143a31",
        chipEdge: "#2f7a63",
        pin: "#45b58d",
        signal: "#5dffc4",
      },
    });
    return () => bg.destroy(); // removes the canvas when you leave the tab
  }, []);
  return null;
}