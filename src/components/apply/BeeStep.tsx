"use client";

// The registration form's "Your bee" step: the wardrobe's builder, saved
// straight to the profile as they go (not part of the application draft), so
// it's waiting for them once they're accepted. Optional; a failed save only
// shows a note.

import { useEffect, useRef, useState } from "react";
import type { Avatar } from "@/lib/avatar";
import { saveBee } from "@/app/dashboard/actions";
import { BeeBuilder } from "@/app/dashboard/avatar/BeeBuilder";
import styles from "@/app/dashboard/avatar/avatar.module.css";

// How long after the last change it saves.
const SETTLE_MS = 800;

// onChange hands the form the latest bee, so coming back to the step (which
// remounts it) starts from what they built, not from what the page loaded with.
export default function BeeStep({
  saved,
  savedName,
  onChange,
}: {
  saved: Avatar;
  savedName: string;
  onChange: (bee: { avatar: Avatar; name: string }) => void;
}) {
  const [avatar, setAvatar] = useState(saved);
  const [name, setName] = useState(savedName);
  const [failed, setFailed] = useState(false);
  // The latest bee waiting to be saved (null once sent), and the saves so far,
  // chained so they run one after another.
  const latest = useRef<{ avatar: Avatar; name: string } | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const bee = latest.current;
      if (!bee) return;
      latest.current = null;
      // A request that fails on the way counts as a failed save, and the chain carries on.
      setFailed(!(await saveBee(bee.avatar, bee.name).catch(() => false)));
    });
  };

  const change = (next: { avatar: Avatar; name: string }) => {
    setAvatar(next.avatar);
    setName(next.name);
    latest.current = next;
    onChange(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SETTLE_MS);
  };

  // Leaving the step unmounts it: send whatever hasn't gone yet.
  useEffect(() => () => flush(), []);

  return (
    <div className={styles.embed}>
      <BeeBuilder lite avatar={avatar} onAvatar={(next) => change({ avatar: next, name })} name={name} onName={(next) => change({ avatar, name: next })} />
      <p role="status" className={styles.note}>
        {failed ? "Your bee couldn't be saved. You can build it after you're accepted." : ""}
      </p>
    </div>
  );
}
