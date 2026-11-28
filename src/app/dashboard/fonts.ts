import { Press_Start_2P, VT323 } from "next/font/google";

// The passport's pixel and terminal faces, shared with the avatar wardrobe.
export const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel", display: "swap" });
export const terminal = VT323({ weight: "400", subsets: ["latin"], variable: "--font-terminal", display: "swap" });
