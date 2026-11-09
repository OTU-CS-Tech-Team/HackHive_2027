import { Suspense } from "react";
import type { Metadata } from "next";
import MeadowDemo from "./demo";

export const metadata: Metadata = {
  title: "Meadow prototype | HackHive 2027",
};

export default function MeadowPrototypePage() {
  return (
    <Suspense fallback={null}>
      <MeadowDemo />
    </Suspense>
  );
}
