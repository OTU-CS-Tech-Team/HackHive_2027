"use client";

import { useEffect, useState } from "react";
import { mintCheckinToken } from "./actions";

const REFRESH_MS = 4 * 60 * 1000; // a bit under the 5 min token expiry

export function CheckinQr({ initialQrDataUrl }: { initialQrDataUrl: string }) {
  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl);

  useEffect(() => {
    const interval = setInterval(async () => setQrDataUrl(await mintCheckinToken()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL
    <img
      src={qrDataUrl}
      alt="Your check-in QR code. Show it at check-in, events, and the help desk. It refreshes every few minutes."
      width={240}
      height={240}
    />
  );
}
