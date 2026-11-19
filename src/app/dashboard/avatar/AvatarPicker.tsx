"use client";

import Link from "next/link";
import { useState, useTransition, type CSSProperties } from "react";
import { COLORS, SLOTS, SLOT_IDS, type Avatar, type ColorId, type Slot } from "@/lib/avatar";
import { saveAvatar } from "../actions";
import { pixel, terminal } from "../fonts";
import { Bee, CROPS, PAINT } from "./Bee";
import styles from "./avatar.module.css";

type Change = { item?: string; color?: ColorId };

// Native radio groups throughout: arrow keys, grouping and screen-reader
// announcements come free; the labels are the tiles and swatches.
export function AvatarPicker({ saved }: { saved: Avatar }) {
  const [avatar, setAvatar] = useState(saved);
  const [slot, setSlot] = useState<Slot>("top");
  const [changed, setChanged] = useState<Slot>();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const current = avatar[slot];
  // The bee as it is, with one change in the open slot.
  const trying = (change: Change) => ({ ...avatar, [slot]: { ...current, ...change } }) as Avatar;
  const wear = (change: Change) => {
    setAvatar(trying(change));
    setChanged(slot);
  };

  return (
    <div className={`${pixel.variable} ${terminal.variable} ${styles.layout}`}>
      <h1 className={styles.title}>Build your bee</h1>

      <div className={styles.stage}>
        <Bee avatar={avatar} pop={changed} className={styles.preview} />
      </div>

      <section className={styles.panel} aria-label="Wardrobe">
        <fieldset className={styles.tabs}>
          <legend className="sr-only">What to change</legend>
          {SLOT_IDS.map((id) => (
            <label key={id} className={styles.tab}>
              <input type="radio" name="slot" className="sr-only" checked={slot === id} onChange={() => setSlot(id)} />
              {SLOTS[id].label}
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.items}>
          <legend className="sr-only">{SLOTS[slot].label}</legend>
          {Object.entries(SLOTS[slot].items).map(([item, label]) => (
            <label key={`${slot}-${item}`} className={styles.item}>
              <input type="radio" name={`${slot}-item`} className="sr-only" checked={current.item === item} onChange={() => wear({ item })} />
              <Bee avatar={trying({ item })} still viewBox={CROPS[slot]} className={styles.thumb} />
              <span className={styles.label}>{label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.colors} disabled={current.item === "none"}>
          <legend className={styles.colorsTitle}>Colour</legend>
          {SLOTS[slot].colors.map((color) => (
            <label key={color} className={styles.swatch} title={COLORS[color]}>
              <input type="radio" name={`${slot}-color`} className="sr-only" checked={current.color === color} onChange={() => wear({ color })} />
              <span className={styles.hex} style={{ "--paint": PAINT[color][0] } as CSSProperties} />
              <span className="sr-only">{COLORS[color]}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.save}
          disabled={pending}
          onClick={() => startTransition(async () => setMessage(await saveAvatar(avatar)))}
        >
          {pending ? "Saving…" : "Save avatar"}
        </button>
        <Link href="/dashboard?tab=passport" className={styles.back}>
          Back to passport
        </Link>
        <p role="status" className={styles.message}>
          {message}
        </p>
      </div>
    </div>
  );
}
