"use client";

// The bee builder itself: the lit stage and the wardrobe panel, with the name
// field on top. The wardrobe page lays these two out side by side; the
// registration form's "Your bee" step stacks them.

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { webglAvailable } from "@/components/landing/meadow/quality";
import { COLORS, NAME_MAX, SLOTS, SLOT_IDS, type Avatar, type ColorId, type Slot } from "@/lib/avatar";
import { Bee, CROPS, PAINT } from "./Bee";
import styles from "./avatar.module.css";

type Change = { item?: string; color?: ColorId };

// three.js only loads here, in the browser. Without WebGL the flat bee stands in.
const Bee3D = dynamic(() => import("./Bee3D"), { ssr: false, loading: () => <div className={styles.viewer} /> });
let gl: boolean | undefined;
const hasWebgl = () => (gl ??= webglAvailable());
const noSubscribe = () => () => {};

// Motes rising off the plinth: [left %, seconds a rise, seconds already risen].
const MOTES = [
  [33, 4.2, 0],
  [61, 5, 1.3],
  [44, 3.6, 2.1],
  [69, 4.6, 0.6],
  [27, 5.4, 3],
  [55, 3.9, 3.6],
  [39, 4.8, 1.8],
  [65, 4.1, 2.7],
];

// Native radio groups throughout: arrow keys, grouping and screen-reader
// announcements come free; the labels are the tiles and swatches.
export function BeeBuilder({
  avatar,
  onAvatar,
  name,
  onName,
}: {
  avatar: Avatar;
  onAvatar: (next: Avatar) => void;
  name: string;
  onName: (next: string) => void;
}) {
  const [slot, setSlot] = useState<Slot>("top");
  const [changed, setChanged] = useState<Slot>();
  const webgl = useSyncExternalStore(noSubscribe, hasWebgl, () => false);

  const current = avatar[slot];
  // The bee as it is, with one change in the open slot.
  const trying = (change: Change) => ({ ...avatar, [slot]: { ...current, ...change } }) as Avatar;
  const wear = (change: Change) => {
    onAvatar(trying(change));
    setChanged(slot);
  };

  return (
    <>
      <div className={styles.stage}>
        <div className={styles.hud}>
          {MOTES.map(([left, rise, risen]) => (
            <span key={left} className={styles.mote} style={{ left: `${left}%`, animationDuration: `${rise}s`, animationDelay: `-${risen}s` }} />
          ))}
          {webgl ? <Bee3D avatar={avatar} pop={changed} /> : <Bee avatar={avatar} pop={changed} className={styles.preview} />}
        </div>
      </div>

      <section className={styles.panel} aria-label="Wardrobe">
        <label className={styles.nameField}>
          <span>
            Name your bee <span className={styles.optional}>Optional</span>
          </span>
          <input type="text" value={name} maxLength={NAME_MAX} placeholder="e.g. Buzz" autoComplete="off" onChange={(e) => onName(e.target.value)} />
        </label>

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
          <legend className={styles.colorsTitle}>
            Colour: <span className={styles.colorName}>{current.item === "none" ? "" : COLORS[current.color]}</span>
          </legend>
          {SLOTS[slot].colors.map((color) => (
            <label key={color} className={styles.swatch} title={COLORS[color]} style={{ "--paint": PAINT[color][0] } as CSSProperties}>
              <input type="radio" name={`${slot}-color`} className="sr-only" checked={current.color === color} onChange={() => wear({ color })} />
              <span className={styles.hex} />
              <span className="sr-only">{COLORS[color]}</span>
            </label>
          ))}
        </fieldset>
      </section>
    </>
  );
}
