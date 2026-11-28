# Build your bee during registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicants build and optionally name their bee in a new "Your bee" step of the `/apply` form. It's saved to their profile, and they meet it, name included, once accepted.

**Architecture:**
- The wardrobe's picker is split into a shared `BeeBuilder` (stage, wardrobe panel, name field), used by the wardrobe page and by a new `BeeStep` inside the form.
- The name rides in the existing `profiles.avatar` JSON as `name`, cleaned by one helper in `src/lib/avatar.ts`.
- Applicants save through a new signed-in-only action. The wardrobe's accepted-only save now carries the name.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Supabase, CSS modules, three.js via the existing `Bee3D`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-bee-in-registration-design.md`

## Global Constraints

- Name: optional; trimmed; runs of whitespace (including newlines) become one space; at most 24 characters counted by code point. Blank means no `name` key is stored.
- No migration. The name is stored as `name` inside `profiles.avatar`. `avatarOf` and `parseAvatar` stay slot-only.
- The bee can never block Submit, and can never break `/apply`: not with a missing avatar column, a failed save, or no WebGL.
- People who already submitted get no new path.
- three.js loads on `/apply` only once the "Your bee" step is opened.
- No commits during the build: the branch already holds Tabish's uncommitted avatar work, and he commits when ready. Each task ends with a check run instead.
- Copy, exactly:
  - Step title: "Your bee"
  - Step blurb: "Build the bee you'll meet on your passport if you get in. It's optional, and saves as you go."
  - Section title: "Build your bee"
  - Name label: "Name your bee", with "Optional" beside it; placeholder "e.g. Buzz"
  - Failure note: "Your bee couldn't be saved. You can build it after you're accepted."
  - Confirmation line: "If you're accepted, your bee will be waiting on your passport."
  - Wardrobe title: the name, or "Build your bee" when there isn't one.

## Review Focus

1. **Someone partway through a draft reopens the form.** It now has 8 steps. It opens on step 1 as before, and the sidebar only checks "Your bee" once they've visited it. Browser check in Task 4.
2. **The bee save fails** (no avatar column, network). The quiet note shows, the form's own "Saved …" status is untouched, and Submit still works. Test in Task 2, browser check in Task 4.
3. **Quick changes, then leaving the step.** The last bee and name is what's stored, and an older save can never land after a newer one. Saves are chained one after another in Task 4, and the save requests are watched in the browser.
4. **Odd names**: emoji, 30 characters pasted in, only spaces, newlines. They're stored cleaned. Tests in Task 1; the input caps at 24 in Task 3.
5. **Naming in registration, then saving in the wardrobe after acceptance**, keeps the name. Test in Task 2.

---

### Task 1: Name helpers

**Files:**
- Modify: `src/lib/avatar.ts` (after `parseAvatar`)
- Test: `tests/avatar.test.ts`

**Interfaces:**
- Produces:
  - `NAME_MAX = 24`
  - `cleanName(value: unknown): string`
  - `beeName(stored: unknown): string`: the cleaned `name` from a stored `profiles.avatar`, or `""`
  - `beeRecord(avatar: unknown, name: unknown): (Avatar & { name?: string }) | null`: `parseAvatar(avatar)` plus the cleaned name (key left out when blank); `null` when the bee is invalid

- [ ] **Step 1: Write the failing tests** (add to `tests/avatar.test.ts`, importing the three new names; reuse its `custom`)

```ts
describe('bee names', () => {
  it('trims, keeps one space between words, and caps at 24 characters', () => {
    expect(cleanName('  Sir   Buzz\n the Third  ')).toBe('Sir Buzz the Third');
    expect(cleanName('B'.repeat(30))).toBe('B'.repeat(24));
  });

  it('never cuts an emoji in half', () => {
    expect(cleanName('🐝'.repeat(30))).toBe('🐝'.repeat(24));
  });

  it('is blank for anything that is not text', () => {
    for (const junk of [null, undefined, 42, {}, ['Buzz'], '   ']) expect(cleanName(junk)).toBe('');
  });

  it('reads the name back from a stored bee', () => {
    expect(beeName({ ...DEFAULT_AVATAR, name: ' Buzz ' })).toBe('Buzz');
    expect(beeName(DEFAULT_AVATAR)).toBe('');
    expect(beeName(null)).toBe('');
  });

  it('stores the slots with the name, and leaves a blank name out', () => {
    expect(beeRecord(custom, ' Buzz ')).toEqual({ ...custom, name: 'Buzz' });
    expect(beeRecord(custom, '   ')).toEqual(custom);
    expect(beeRecord({ ...custom, top: { item: 'cape', color: 'red' } }, 'Buzz')).toBeNull();
  });

  it('never lets a stored name change what the bee wears', () => {
    expect(avatarOf({ ...custom, name: 'Buzz' })).toEqual(custom);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/avatar.test.ts`
Expected: FAIL, because `cleanName` / `beeName` / `beeRecord` aren't exported.

- [ ] **Step 3: Implement the three helpers and `NAME_MAX` in `src/lib/avatar.ts`.** Cap with `Array.from(...).slice(0, NAME_MAX).join("")`, so code points are counted. `beeName` reads `record(stored).name`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/avatar.test.ts`
Expected: PASS (the 4 existing tests and the 6 new ones)

### Task 2: Save actions

**Files:**
- Modify: `src/app/dashboard/actions.ts` (`saveAvatar`, plus the new `saveBee` beside it)
- Test: `tests/avatar-actions.test.ts` (new; mocks in the style of `tests/team-listing-actions.test.ts`)

**Interfaces:**
- Consumes: `beeRecord` (Task 1)
- Produces:
  - `saveBee(avatar: unknown, name: unknown): Promise<boolean>`. Signed in only, with no hub check. It writes `profiles.avatar = beeRecord(...)` for the caller's own row and returns `true` on success. It returns `false` when signed out, when the bee is invalid, or when the write errors, and never throws for those. No redirect.
  - `saveAvatar(avatar: unknown, name: unknown)`. Same as today: an accepted-only check through `requireHubUser`, a message on failure, a redirect to `/dashboard?tab=passport` on success. It now writes `beeRecord(avatar, name)`.

- [ ] **Step 1: Write the failing tests.** Mock `server-only`, `next/cache`, `next/navigation` (`redirect: vi.fn()`) and `@/lib/supabase/server`. The session is `{ from, rpc, auth.getUser }`, with an `update().eq()` chain that resolves to `{ error }`. Then:

```ts
it('lets any signed-in applicant save their bee and its name', async () => {
  const { query } = setup({ hub: false });
  expect(await saveBee(DEFAULT_AVATAR, '  Buzz ')).toBe(true);
  expect(query.update).toHaveBeenCalledWith({ avatar: { ...DEFAULT_AVATAR, name: 'Buzz' } });
  expect(query.eq).toHaveBeenCalledWith('id', 'self');
});

it('saves nothing when signed out or when the bee is not from the wardrobe', async () => {
  const signedOut = setup({ user: null });
  expect(await saveBee(DEFAULT_AVATAR, 'Buzz')).toBe(false);
  expect(signedOut.query.update).not.toHaveBeenCalled();
  const { query } = setup();
  expect(await saveBee({ ...DEFAULT_AVATAR, top: { item: 'cape', color: 'red' } }, 'Buzz')).toBe(false);
  expect(query.update).not.toHaveBeenCalled();
});

it('reports a failed write as false instead of throwing', async () => {
  setup({ error: { message: 'column "avatar" does not exist' } });
  expect(await saveBee(DEFAULT_AVATAR, 'Buzz')).toBe(false);
});

it('keeps the name when an accepted hacker saves in the wardrobe', async () => {
  const { query } = setup();
  await saveAvatar(DEFAULT_AVATAR, 'Buzz');
  expect(query.update).toHaveBeenCalledWith({ avatar: { ...DEFAULT_AVATAR, name: 'Buzz' } });
  expect(redirect).toHaveBeenCalledWith('/dashboard?tab=passport');
});

it('still keeps the wardrobe save to accepted hackers', async () => {
  setup({ hub: false });
  await expect(saveAvatar(DEFAULT_AVATAR, 'Buzz')).rejects.toThrow('Only accepted hackers');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/avatar-actions.test.ts`
Expected: FAIL, because `saveBee` isn't exported and `saveAvatar` writes no name.

- [ ] **Step 3: Implement `saveBee` and update `saveAvatar`** as described in Interfaces. Wrap `saveBee`'s auth and write in try/catch so it always resolves.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/avatar-actions.test.ts tests/team-listing-actions.test.ts`
Expected: PASS (the second file also imports `dashboard/actions`)

### Task 3: Shared builder and the wardrobe title

**Files:**
- Create: `src/app/dashboard/avatar/BeeBuilder.tsx`
- Modify:
  - `src/app/dashboard/avatar/AvatarPicker.tsx`
  - `src/app/dashboard/avatar/page.tsx`
  - `src/app/dashboard/avatar/avatar.module.css`

**Interfaces:**
- Consumes: `beeName`, `NAME_MAX` (Task 1); `saveAvatar(avatar, name)` (Task 2)
- Produces:
  - `BeeBuilder({ avatar, onAvatar, name, onName }: { avatar: Avatar; onAvatar: (next: Avatar) => void; name: string; onName: (next: string) => void })`. It returns a fragment, the `.stage` and the `.panel`, so they stay direct children of the wardrobe's `.layout` grid. It owns the open-slot state, the just-changed slot (for the pop), WebGL detection, `MOTES` and the dynamic `Bee3D`, all moved from `AvatarPicker`. It adds the name field at the top of the panel: an `<input maxLength={NAME_MAX}>`, with the label and placeholder from Global Constraints.
  - `AvatarPicker({ saved, savedName }: { saved: Avatar; savedName: string })`. It keeps the header, the actions and `Flight`, and holds the `avatar` and `name` state. The `<h1>` shows the live name or "Build your bee". Save calls `saveAvatar(avatar, name)`.
  - CSS classes:
    - `.embed`: the dark card the form uses. It carries `--comb`, the `#0a0a0c` background and white text, and lays its children out stacked. Its `.stage` sticks at `top: 0`.
    - `.nameField`: the label, the "Optional" note and a dark input with honey focus.
    - Every rule inside `@media (min-width: 900px)` is prefixed with `.layout`, so the two-column layout only applies on the wardrobe page. The spec asks for a container query; this scoping gives the same result, because the wardrobe is always full-width and the form step always narrow. (Plan's call.)

- [ ] **Step 1: Split out `BeeBuilder`, add the name field, pass `savedName` from the page** (`beeName(data?.avatar)` beside the existing `avatarOf(data?.avatar)`), and scope the CSS.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p . ; npx eslint src/app/dashboard`
Expected: exit 0, no new warnings

- [ ] **Step 3: Check it in the browser.** Use a temporary unauthenticated preview route rendering `<AvatarPicker saved=… savedName=… />`. Delete it while the dev server is still running, so `.next/dev/types` drops it.
  - The wardrobe looks as before at 1400×800 and 390×844.
  - Typing a name updates the title live. A blank name shows "Build your bee".
  - The input stops at 24 characters.

### Task 4: The "Your bee" step

**Files:**
- Create: `src/components/apply/BeeStep.tsx`
- Modify:
  - `src/components/apply/ApplyForm.tsx` (`STEPS`, the `reviewed` state, `stepDone`, props, a new panel)
  - `src/app/apply/page.tsx`

**Interfaces:**
- Consumes: `BeeBuilder` (Task 3); `saveBee` (Task 2); `avatarOf`, `beeName` (Task 1); `styles.embed` (Task 3)
- Produces:
  - `BeeStep` default export, `({ saved, savedName }: { saved: Avatar; savedName: string })`. It holds the `avatar` and `name` state and renders `<div className={styles.embed}><BeeBuilder …/></div>`, with the failure note under it in a `role="status"` paragraph.
  - Saving starts after the first change, never on mount. It runs 800 ms after the last change and again on unmount (leaving the step). Each save chains onto the previous promise, so saves run one after another, and each sends the latest bee and name. A `false` result shows the failure note; a later `true` hides it.
  - `ApplyFormProps` gains `bee: Avatar; beeName: string`.

- [ ] **Step 1: Load the bee on `/apply`.** Add `supabase.from("profiles").select("avatar").eq("id", user.id).maybeSingle()` as its own entry in the existing `Promise.all`, so a missing column can't touch `avatar_url`. Pass `bee={avatarOf(row?.avatar)}` and `beeName={beeName(row?.avatar)}`.

- [ ] **Step 2: Add the step to `ApplyForm`:**
  - Add `{ id: "bee", title: "Your bee", blurb: <copy>, sections: [{ id: "bee", title: "Build your bee" }], fields: [] }` right after the `"event"` entry, and `const BEE_STEP = REVIEW_STEP - 1`.
  - Replace the `reviewed` boolean with `seen: number[]`. `changeStep` adds the index. `stepDone(i)` is `STEPS[i].fields.length ? missingPerStep[i] === 0 : seen.includes(i)`. This covers Review and Your bee alike.
  - Load `BeeStep` with `next/dynamic` (`ssr: false`).
  - Add `panel(BEE_STEP, step === BEE_STEP && <FormSection id={sectionId("bee")} title="Build your bee"><BeeStep saved={bee} savedName={beeName} /></FormSection>)` between the event panel (`panel(4, …)`) and the Review panel.

- [ ] **Step 3: Typecheck, lint, and run the form's tests**

Run: `npx tsc --noEmit -p . ; npx eslint src/components/apply src/app/apply ; npx vitest run tests/application-flow.test.ts tests/applications.test.ts`
Expected: exit 0 and PASS

- [ ] **Step 4: Check it in the browser.** Use a temporary preview route that renders `<ApplyForm>` with a draft and a bee, then delete it as in Task 3.
  - "Step 6 of 8 · Your bee" comes after The event.
  - No canvas, and no three.js chunk requested, until the step opens.
  - The 3D bee and the panel are stacked in the 640px column. On a phone (390×844) the stage sticks at the top while the tiles scroll.
  - The sidebar checks the step after a visit. "What's left" never lists it.
  - With reduced motion or no WebGL, the 2D bee shows.
  - The preview is signed out, so `saveBee` returns `false` there. Check that the note shows inside the step, and that the form's status line shows only what the draft save says.
  - Change pieces and the name quickly, then leave the step at once. Watch the server-action requests in Playwright. Saves never overlap, and the last one carries the latest bee and name. (Persistence across a reload needs a signed-in account; that's left for Tabish's check on the real page.)

### Task 5: Confirmation line, README, final run

**Files:**
- Modify:
  - `src/app/apply/confirmation/page.tsx` (one more item in the "What's next?" list)
  - `README.md` (the Bee avatar section)

- [ ] **Step 1: Add the confirmation line** from Global Constraints as a fourth item of the "What's next?" list. The page stays static.

- [ ] **Step 2: Add to README's Bee avatar section:** applicants can build and name their bee in the form's optional "Your bee" step. It saves to their profile straight away and shows up once they're accepted. The name is the Build your bee page's title. There's no new migration.

- [ ] **Step 3: Full run**

Run: `npx tsc --noEmit -p . ; npm run lint ; npx vitest run`
Expected: tsc exit 0; lint shows no errors and only the 3 warnings already on `main`; every test file passes (46 before this plan, 47 with `avatar-actions`).
