# Feature: Mistake pattern view

**From build-plan:** feature 10
**Build attempt:** 1
**Branch:** feature/mistake-pattern-view
**Status:** verified

## Goal

Give the learner one screen that shows which Error categories actually recur
across their Attempts, and how each one is trending, so the Mistake pattern
(CONTEXT.md: "an Error category that recurs across a Learner's Attempts,
together with its frequency and trend") is visible without opening the journal
files by hand. Today the only cross-Attempt signal is `journal/mistakes.md`,
which holds running totals with no dates, and the app only shows it to the
model inside the correction prompt.

## In scope

- A new route `/muster`, titled "Fehlermuster", reachable from the Schreiben
  and Sprechen screens.
- Reading the Attempt files in the connected journal folder (Schreiben and
  Sprechen alike, matching the skill-agnostic aggregate in `journal.ts`) and
  computing patterns from their frontmatter `date:` and `categories:` lines,
  plus one example per category from their `## Mistakes` section.
- "Recurs" means the category appears in **two or more distinct Attempts**.
- Layout, revised after the first browser look because a per-Attempt strip of
  squares was too hard to read:
  - **"Worauf du achten solltest":** the top three recurring categories as
    cards. Each card shows the label, "in N von M Attempts", a status word
    (see Data / contracts), and one real example from the learner's own
    Attempt: what was written, struck through, then the correction.
  - **"Weitere":** the remaining recurring categories, one line each with
    "N von M".
  - **"Nur einmal gesehen":** categories from a single Attempt, as one line of
    labels.
- Every folder state handled in place: unsupported browser, no folder chosen,
  folder chosen but permission lapsed after a reload (with a reconnect button,
  which is a user gesture), loading, empty journal, Attempts with no mistakes
  at all, files that cannot be parsed, and an unexpected read error.

## Out of scope

- Browsing or reopening past Attempts, their Feedback, or comparing two
  Attempts. That is item 12.
- Splitting patterns by skill (Schreiben vs Sprechen) or by Teil.
- Changing `journal/mistakes.md`, its format, or how `saveAttempt` /
  `saveSpeakingAttempt` maintain it. It stays the input to the correction
  prompt exactly as today.
- Changing the correction prompt, the taxonomy, or the Attempt file format.
- Charts, a charting dependency, or any statistic beyond the status word below.
- A download-fallback equivalent for reading. Downloads cannot be read back;
  without the File System Access API the screen explains that and stops.

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then one review packet
for the whole feature. `workflow.checkpointCommits` is `disabled`: no
checkpoint commits between steps. `/complete` creates the single feature
commit.

## Build steps

- [x] **1. Pattern computation in `src/lib/patterns.ts`.** A pure module, no
  I/O. `parseAttemptRecord(markdown)` reads the leading `---` frontmatter block
  and the `## Mistakes` lines, and returns `{ date, categories, skill,
  examples }` or `null` when there is no frontmatter, no parseable `date:`, or
  no `categories:` line. `categories:
  none` yields an empty list. `skill` is `'sprechen'` when a `skill: sprechen`
  line is present, otherwise `'schreiben'`. `summarisePatterns(records)` sorts
  records oldest first and returns one row per category in the shape under
  Data / contracts, recurring rows first, each group ordered by Attempts
  desc, then instances desc, then most recently seen.
  **Done when:** `npx tsc --noEmit` and `npm run lint` pass, and the module
  imports nothing from React, the router, or `journal.ts`.

- [x] **2. Reading the journal in `src/lib/journal.ts`.** Add
  `folderAccess(): Promise<'unsupported' | 'none' | 'needs-permission' |
  'ready'>`, distinguishing a missing handle from a lapsed grant (today
  `storedFolder()` returns `null` for both). Add `readAttemptRecords():
  Promise<{ records: AttemptRecord[]; unreadable: number } | null>` (null when
  the grant is gone), which iterates the
  folder like `countAttemptFiles` does (`.md` files, excluding `mistakes.md`),
  reads each file, and counts files that fail to read or parse instead of
  throwing on them. Existing exports and the save paths are untouched.
  **Done when:** `npx tsc --noEmit` and `npm run lint` pass, and Settings still
  shows the connected folder name and reconnects as before.

- [x] **3. The `/muster` screen.** `src/app/muster.tsx`, registered in
  `src/app/_layout.tsx` as "Fehlermuster". A single phase union
  (`'loading' | 'unsupported' | 'none' | 'needs-permission' | 'ready' |
  'error'`), loaded with `useFocusEffect` so returning from a new Attempt shows
  fresh counts. Reconnect calls the existing `reconnectFolder()` from the
  button press, then reloads. Link to it with `Link href="/muster"` from the
  Schreiben choose-phase header (next to "Sprechen →" and "Einstellungen") and
  from the equivalent header on the Sprechen screen.
  **Done when:** in Chromium with the real `journal/` folder connected, the
  screen lists every category from the five current Attempt files, the "N von
  M" counts match those files' `categories:` lines when checked by hand, and
  each focus card's example is a real line from that category's most recent
  Attempt; reloading the page shows
  the reconnect state and the button restores the list; a browser without
  `showDirectoryPicker` (or Settings with no folder chosen, using a fresh
  profile) shows the matching message instead of a crash or a blank screen; and
  `npx tsc --noEmit` and `npm run lint` pass.

- [x] **4. Clear the existing lint errors.** Added at completion, at the
  user's request, so the `npm run lint` done-when above can hold. The six
  errors pre-dated this feature: the two wait counters reset in their effect's
  cleanup instead of its body; Settings reads with `useFocusEffect` like the
  other screens; `fetchModels` depends on plain `apiKey` and `model`
  variables; `use-color-scheme.web.ts` detects hydration with
  `useSyncExternalStore`; and the one-time draft restore in `index.tsx` keeps
  its effect with a reasoned disable comment, because reading localStorage
  during render would break the static web hydration.
  **Done when:** `npm run lint` reports no problems and `npx tsc --noEmit`
  passes.

## Files / areas

- `src/lib/patterns.ts` (new) - frontmatter parsing and aggregation.
- `src/lib/journal.ts` - `folderAccess`, `readAttemptRecords`; the existing
  `DirHandle` type already has `values()` and `getFileHandle()`.
- `src/lib/taxonomy.ts` - read only: `categoryById`, `categoryLabel`,
  `ERROR_GROUPS`.
- `src/app/muster.tsx` (new) - the screen.
- `src/app/_layout.tsx` - one `Stack.Screen`.
- `src/app/index.tsx`, `src/app/sprechen.tsx` - one link each; step 4 lint fixes.
- `src/app/settings.tsx`, `src/hooks/use-color-scheme.web.ts` - step 4 lint fixes only.

## Data / contracts

No new persisted data. The view reads files that already exist and writes
nothing.

Input, from the Attempt file frontmatter both writers already emit:

```text
date: <ISO-8601 string>              # Attempt.createdAt
categories: <id>, <id>, ... | none   # one entry per Mistake instance, repeats kept
skill: sprechen                      # Sprechen files only
```

A category id that appears several times on one line counts once toward
Attempts and once per occurrence toward instances.

```ts
type MistakeExample = { category: string; wrote: string; correction: string };

type AttemptRecord = {
  date: string;
  categories: string[];
  skill: 'schreiben' | 'sprechen';
  examples: MistakeExample[]; // from lines: - `category` **wrote** → **correction**
};

type PatternRow = {
  category: string;     // ErrorCategoryId, or an unknown id kept verbatim
  attempts: number;     // distinct Attempts containing it
  instances: number;    // total Mistake instances (used for ordering)
  lastSeen: string;     // ISO date of the most recent Attempt containing it (ordering)
  recurring: boolean;   // attempts >= 2
  inRecent: boolean;    // appears in one of the last RECENT_ATTEMPTS (2) Attempts
  example?: MistakeExample; // from the most recent Attempt containing it
};
```

**Trend** is one status word on each focus card: "Immer wieder" (danger) when
the category appears in either of the last two Attempts, "Zuletzt nicht mehr"
(success) when it is missing from both. Two, not one, because the latest
Attempt may simply be the other skill; with one, the most frequent mistake in
the journal today would wrongly read as easing off.

A missing or malformed Mistakes line only drops that card's example; the counts
come from the frontmatter.

Unknown ids (a category no longer or never in `taxonomy.ts`) are still counted
and shown with the raw id, so a taxonomy drift is visible rather than silently
dropped. Category ids and the learner's quoted words are rendered as plain `Text`,
never as markup.

## Testing

No `test` command is configured, so there are no unit tests in this feature.
Evidence is `npx tsc --noEmit`, `npm run lint`, and the Chromium check in step
3 against the real journal folder. No Gemini call is needed to verify this
feature, so none should be spent.

Note for typed routes: `/muster` becomes a valid `href` only after Expo
regenerates the route types, which happens when the dev server starts. Start
`npx expo start --web` once before trusting a `tsc` failure on the new `Link`.

## Notes for the AI

- Chrome in German ("Fehlermuster", "Worauf du achten solltest", "Journal
  verbinden"),
  explanations in English, as everywhere else.
- Colour is semantic: danger for what was written and "Immer wieder", success
  for the correction and "Zuletzt nicht mehr", primary for links and the
  reconnect button, surfaces otherwise. Both schemes must work.
- Use `Spacing` and `MaxContentWidth` from `src/constants/theme.ts`, and
  `StyleSheet.create` at the bottom of the file.
- The `skill` field is parsed but not displayed in this feature; it exists so
  item 12 does not need to reparse.
- Reading five to a few dozen small local files is fast; a plain "Lese
  Journal…" line is enough for loading. No elapsed counter is needed because no
  network wait is involved.
- Do not write to `mistakes.md` from this screen, even though its totals can
  drift from the files (for example after deleting an Attempt by hand). The
  screen is computed from the files, which is the reason it is trustworthy.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10601,"specSha256":"bad700461114bd6c5ac8d750d06d139922358c492700c8d05072002c87770d58","branch":"refs/heads/feature/mistake-pattern-view","head":"ee05e995084fd59ffae294c48471d434bc23cbd9","baseRef":"refs/heads/main","baseCommit":"2073f05d393bd3644ce493ab9e322936ea8f9f11","sourceTree":"019b7ed22ab0575fcadd9250088e905fa0ea00cb","absentOptional":[]} -->
