"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState, useTransition } from "react";
import type { Avatar } from "@/lib/avatar";
import { saveAvatar } from "../actions";
import { topBee } from "./Bee";
import { BeeBuilder } from "./BeeBuilder";
import styles from "./avatar.module.css";

// Decoration only, so it waits for the browser.
const Flight = dynamic(() => import("./Flight"), { ssr: false });

// The dashboard's Your bee tab: the builder, titled with the bee's name, and a Save that
// goes back to the passport.
export function AvatarPicker({ saved, savedName }: { saved: Avatar; savedName: string }) {
  const [avatar, setAvatar] = useState(saved);
  const [name, setName] = useState(savedName);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.layout}>
      <header className={styles.title}>
        <svg viewBox="-14 -14 28 28" className={styles.mark} aria-hidden="true">
          <g transform="rotate(-90)">{topBee()}</g>
        </svg>
        <div>
          <h2>{name.trim() || "Build your bee"}</h2>
          <p className={styles.kicker}>HackHive avatar customizer</p>
        </div>
      </header>

      <BeeBuilder avatar={avatar} onAvatar={setAvatar} name={name} onName={setName} />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.save}
          disabled={pending}
          onClick={() => startTransition(async () => setMessage(await saveAvatar(avatar, name)))}
        >
          {pending ? "Saving…" : "Save avatar"}
        </button>
        <Link href="/dashboard?tab=passport" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to passport
        </Link>
        <p role="status" className={styles.message}>
          {message}
        </p>
      </div>

      <Flight />
    </div>
  );
}
