import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeadowDemo from "./demo";

export const metadata: Metadata = {
  title: "Meadow prototype | HackHive 2027",
};

export default function MeadowPrototypePage() {
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <MeadowDemo />
    </Suspense>
  );
}
