# Build your bee during registration

Draft for Tabish's approval, 2026-11-26. Branch `avatar-tabish`.

## Why

Applicants build their bee and give it a name near the end of registration, then don't see it again until they're accepted. Once accepted, it's waiting for them on their passport and on the Build your bee page. Make it now, see it later.

## What we found

- Registration is the 7-step form at `/apply`: About you, School, Experience, Short answers, The event, Review, Submit. Drafts autosave to `applications`. The profile photo already saves straight to `profiles` from inside the form, not as part of the draft (see `2026-11-16-profile-photo-name-review-design.md`). That's the pattern to follow.
- The bee lives in `profiles.avatar` (jsonb, one `{ item, color }` per slot, checked to stay under 1 KB). The `profiles_update_own` policy already lets any signed-in user update their own row. Only the dashboard's `saveAvatar` is limited to accepted hackers. The passport and the wardrobe both read `profiles.avatar`, so a bee saved during registration is exactly what they'll see after acceptance.
- The bee avatar itself (migration `20261121000000_avatar.sql`, wardrobe, passport bee) exists only on this branch, not on `main`. This ships with it.
- `main` has changed the form since this branch split off: MLH consent boxes in the Submit step, and draft reminder emails. The new step goes in a different part of the form, so the merge should be clean or need only a small fix.
- The builder (`AvatarPicker`) is a full-page layout that switches to two columns at a 900px *window*. The form's content column is 640px wide, so inside the form the builder must lay itself out by its own width.

## Decided

1. **People who already submitted get no new path** (Tabish). They start from the default bee and build and name it in the wardrobe once accepted.
2. **A step inside the existing form** (Tabish), not a separate page.
3. **"Your bee" comes after "The event", before Review** (8 steps). It's optional: the default bee is already picked, the step never counts as missing, and nothing in it can stop an application being submitted.
4. **The name is optional, up to 24 characters.** It's the Build your bee page's title when set, and can be changed there. That also gives people who registered earlier a way to name theirs.
5. **The confirmation page gets one line** saying the bee will be waiting on their passport if they're accepted.

## Design

### Storage: no migration

- The name is stored in the same `profiles.avatar` JSON as `name`. `avatarOf` and `parseAvatar` stay slot-only, so nothing that draws the bee changes. A new `beeName(value)` reads the name back out.
- One cleaning rule, used everywhere: trim, collapse runs of whitespace (including newlines) to one space, and cap at 24 characters, counted by code point so an emoji is never cut in half. Blank means no name, and the key is left out of the JSON.
- Every save writes the slots and the name together. The wardrobe's existing Save must carry the name, or saving there would wipe it.

### Saving

- **New server action for the form:** signed-in only, like `saveAvatarUrl`. It validates the bee with `parseAvatar`, cleans the name, updates `profiles.avatar`, and returns ok or a message. It doesn't redirect.
- **The wardrobe's `saveAvatar`** keeps its accepted-only check and its redirect to the passport, and now takes the name too.
- **In the form, the bee saves as they go:** a moment after the last change, and again when they leave the step, with the latest change winning. A failed save shows a quiet note inside the step ("Your bee couldn't be saved. You can build it after you're accepted.") and doesn't touch the application's "Saved" status.

### The step

- The form keeps every step mounted and hides the others. This one renders its builder only while it's open, so three.js doesn't load until they reach it.
- It uses the same builder as the wardrobe: the 3D bee on its plinth (the 2D bee where there's no WebGL), the tabs, tiles and colours, plus the name field. It stays a dark card inside the light form, so it looks like the wardrobe they'll see later.
- The sidebar marks the step done once it's been visited, like Review. "What's left" doesn't list it.
- Coming back to the form shows their saved bee. `/apply` loads `profiles.avatar` in its own query, so a problem there can't break the photo or the draft.
- The Review step doesn't show the bee. Review is for the application, and the bee isn't part of it.

### Shared builder

- `AvatarPicker` is split into a shared builder (stage, wardrobe panel, name field), used in two places:
  - **The wardrobe page** adds the header with the name, Save, Back to passport and the flying bees.
  - **The form step** adds autosave.
- The builder's layout follows its own width (a container query) instead of the window: two columns when wide (the wardrobe), stacked when narrow (the form, phones).

### Build your bee page

- The title is the bee's name when one is set, otherwise "Build your bee". It updates as they type in the name field, and Save stores it with the bee.

### Confirmation page

- One static line, along the lines of "Your bee will be waiting on your passport if you're accepted." There's no name in it, so the page needs no data and stays static.

## Approaches considered

- **A step inside the form (chosen):** what "during registration" means, and nobody leaves the form.
- **A step that opens a full-page builder:** rejected. It takes applicants out of the form partway through, and some won't come back.
- **A separate `bee_name` column:** rejected. It needs a migration, and the name belongs with the bee. The JSON has room: a 24-character name is at most 96 bytes against the 1 KB check.
- **A lighter 2D-only picker for registration:** rejected. They'd meet a different-looking bee later.

## Non-goals

- An avatar step for people who already submitted (decided above).
- Showing the name anywhere other than the Build your bee page. The passport, admins and teammates don't see it.
- A word filter. Only the owner ever sees the name.

## Anti-goals

- Any registration that fails, slows down or gets stuck because of the bee. The bee can't block Submit, and a missing avatar column or missing WebGL can't break the page.

## Testing

- Unit: the name rule (trim, whitespace, the 24-character cap with emoji), reading the name back, and the form's save action (signed out, an invalid bee, a long or blank name, slots and name written together).
- The wardrobe save keeps the name.
- The form: the step is optional, not listed in "What's left", and an existing draft still submits without visiting it.
- In a browser: the step on desktop and phone sizes, the wardrobe title with and without a name, and a returning applicant seeing their saved bee.

## Deploy

Same as the bee avatar already on this branch: apply `20261121000000_avatar.sql` before deploying. There's no new migration.

## Left to the builder

- Exact copy, the autosave delay, and where the name field sits in the builder.
- Styling, within the existing form and wardrobe looks.
- Merging `main` in: build on this branch; the form changes on `main` are in other parts of the file.
