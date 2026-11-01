import type { Metadata } from "next";
import { PathScene } from "./path-scene";

export const metadata: Metadata = {
  title: "Trailhead prototype · HackHive 2027",
  description: "Look-sign-off for the Walk the Path trailhead. Not the live homepage.",
  robots: { index: false, follow: false },
};

export default function PathPrototypePage() {
  return (
    <>
      <style>{`[data-navbar-shell]{display:none !important}`}</style>
      <PathScene />
    </>
  );
}
