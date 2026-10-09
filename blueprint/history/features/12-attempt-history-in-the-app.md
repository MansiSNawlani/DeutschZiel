# Feature: Attempt history in the app

**From build-plan:** feature 12
**Build attempt:** 1
**Branch:** feature/attempt-history-in-the-app
**Status:** verified

## Goal

Let the learner read their own past Attempts inside the app. Today `journal.ts`
writes every Attempt to the journal folder with its full Feedback, but nothing
in the app reads it back, so past Feedback can only be seen by opening the files
by hand. This feature adds three read-only screens over those same files:

- **Verlauf**, a list of every Attempt, newest first.
- **Versuch**, one Attempt's Submission (or Transcript) and Feedback, reopened.
- **Vergleich**, the first Attempt on a Task next to a later one on the same
  Task, so the learner can see what changed.

It is a reading surface, not new storage. No file is written, renamed or
deleted, and the Attempt file format does not change.

## In scope

- One shared journal reader: list the Attempt files once and hand back each
  file's name and text. `readAttemptRecords` (the Fehlermuster screen) is
  rebuilt on top of it, with no change to what it returns.
- A parser in a new `src/lib/history.ts` that turns one Attempt file into a
  `JournalEntry` (contract below). It accepts both journal formats in the
  folder today:
  - **Legacy** entries, written before feature 9: criteria lines like
    `- **Erfüllung** 2/3 — comment` (em dash separator, 0-3 scale, no Total
    line).
  - **Current** entries: `- **Erfüllung** B (7,5/10) - comment` plus a
    `- **Total**` line.
- Task identity for comparison, taken from the filename, which both writers
  build the same way: `<stamp>-<task.id>.md` or `<stamp>-sprechen-<task.id>.md`.
  The stamp is `YYYY-MM-DD-HHMM` (before the fix in feature 9) or
  `YYYY-MM-DD-HHMMSS` (after it).
- `/verlauf`: every Attempt newest first, each showing the date, Schreiben
  Aufgabe n or Sprechen Teil 2, the title, and the total (current entries) or
  "alte Skala" (legacy entries). When the same Task has two or more Attempts,
  the row shows "Versuch k von n" and a "Vergleichen" link.
- `/versuch?datei=<filename>`: the reopened Attempt. Header (date, skill and
  Teil, words against target or seconds against target), then sections in the
  order the file holds them. Criteria use the existing `Bands` and `TotalRow`
  for current entries. Legacy criteria show `2/3` as text with a one-line note
  that it is the old 0-3 scale, which cannot be converted to A-E. Mistakes are
  shown as category label, what was written, the correction and the
  explanation. Folien and Better phrasings are shown as lists, and every other
  section as plain text.
- `/vergleich?erst=<filename>&spaeter=<filename>`: two Attempts on the same
  Task. It shows each criterion as first against later, the two totals when
  both entries are current, time or words for each, and the Error categories
  split into three groups: gone (in the first only), still there (in both), and
  new (in the later only). Below that are both Submissions or Transcripts, each
  in a `Collapsible`. When the Task has more than two Attempts, a chip row picks
  which later Attempt is compared. The first Attempt stays fixed.
- A "Verlauf" link in the nav rows of `/`, `/sprechen` and `/muster`. The three
  new screens are registered in `_layout.tsx`.
- The folder states the Fehlermuster screen already handles are moved into one
  shared hook and status component, which all four screens use. Those states
  are unsupported browser, no folder chosen, permission lapsed after a reload
  (with a reconnect button), loading, and unexpected error.

## Out of scope

- Writing, editing, deleting or renaming journal files, or touching
  `mistakes.md`.
- Migrating legacy entries to A-E, or guessing a letter from `n/3`.
- Retrying a past Task from the history. Starting a new Attempt stays on `/`
  and `/sprechen`.
- Filtering, search, or pagination. A few dozen small local files load fast.
- Charts or score trends over time.
- Showing the Task instruction diff, or diffing two Submissions word by word.
- Any change to the Gemini prompts, the taxonomy, or the Attempt file format.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then one review packet at
the end. `checkpointCommits` is disabled, so `/complete` makes the only commit.

## Build steps

- [x] **1. Shared journal reader and folder gate.**
  In `journal.ts`, add `readAttemptFiles(): Promise<{ files: { name: string;
  text: string }[]; unreadable: number } | null>` and
  `readAttemptFile(name): Promise<string | null>`. The second refuses any name
  that `isAttemptFile` would reject, so it cannot reach `mistakes.md`.
  Reimplement `readAttemptRecords` on top of `readAttemptFiles`, keeping its
  return shape. Move the folder phase logic out of `muster.tsx` into a
  `useJournal` hook (`src/hooks/use-journal.ts`). The hook takes a loader and
  returns `phase`, `data`, `error`, `reload` and `reconnect`, and reloads on
  focus. Move the matching status UI into `src/components/journal-status.tsx`.
  `muster.tsx` then uses both, with the same copy and states it has today.
  *Done when:* tsc and lint pass, and `/muster` in Chromium behaves as before
  with a ready folder and after a reload (Ordner erneut verbinden). The counts
  match what it showed before the change.

- [x] **2. Parser and the Verlauf list.**
  Add `src/lib/history.ts` with `parseJournalEntry(name, text)` and
  `taskKey(name)` (contracts below). Add `src/app/verlauf.tsx`, which lists
  entries newest first, groups them by `taskKey` for "Versuch k von n", and
  links each row to `/versuch` and multi-Attempt rows to `/vergleich` (first
  against latest). It handles an empty journal and shows the count of
  unreadable files, as `/muster` does. Add the Verlauf links and the
  `_layout.tsx` entries.
  *Done when:* tsc and lint pass, and in Chromium `/verlauf` lists all five
  current journal files. The two legacy Sprechen entries show "alte Skala"
  and the 2026-10-08 Schreiben entry shows `0 / 40`. The three Sprechen
  "Sport im Alltag" rows read Versuch 1-3 von 3 and offer Vergleichen.

- [x] **3. Reopen one Attempt.**
  Add `src/app/versuch.tsx`, which reads `datei` from `useLocalSearchParams`
  and loads it through `readAttemptFile`. It renders the entry as described in
  scope. A missing or unparseable file (for example one deleted since the list
  loaded) shows an in-place message and a link back to `/verlauf`, never a
  blank screen.
  *Done when:* tsc and lint pass. In Chromium, a legacy Sprechen entry, a
  current Sprechen entry and the current Schreiben entry each open with all
  their sections. The Schreiben entry shows Erfüllung E and a zeroed
  `0 / 40` total. `/versuch?datei=nope.md` shows the not-found message.

- [x] **4. Compare first and later.**
  Add `src/app/vergleich.tsx` as described in scope. If the two files do not
  share a `taskKey`, or one is missing, show an in-place message instead of
  comparing.
  *Done when:* tsc and lint pass. In Chromium, comparing the Sprechen
  "Sport im Alltag" Attempts shows legacy `2/3` against current letters
  without a total for the legacy side, and the chips switch between Versuch 2
  and 3. Submitting one seed Schreiben Task twice and comparing the two
  Attempts shows both totals and the gone, still there and new category groups.

## Files / areas

- `src/lib/journal.ts`: new `readAttemptFiles` and `readAttemptFile`.
  `readAttemptRecords` is rebuilt on the first.
- `src/lib/history.ts` (new): `JournalEntry`, `parseJournalEntry`, `taskKey`
- `src/hooks/use-journal.ts` (new), `src/components/journal-status.tsx` (new)
- `src/app/muster.tsx`: moved onto the shared hook and component, plus a
  Verlauf link
- `src/app/verlauf.tsx`, `src/app/versuch.tsx`, `src/app/vergleich.tsx` (new)
- `src/app/_layout.tsx`: three `Stack.Screen` entries (titles Verlauf,
  Versuch, Vergleich)
- `src/app/index.tsx`, `src/app/sprechen.tsx`: a Verlauf link in the nav row
- `src/components/feedback-view.tsx`: reuse of the already exported `Bands` and
  `TotalRow`, with no change expected

## Data / contracts

Nothing new is persisted. Everything below is derived in memory from files the
app already writes.

**`taskKey(name): { skill: 'schreiben' | 'sprechen'; taskId: string } | null`**
matches `^\d{4}-\d{2}-\d{2}-\d{4}(\d{2})?-(sprechen-)?(.+)\.md$`. A name that
does not match returns null. That entry is still listed and opened, but it is
never grouped or compared.

**`JournalAttempt`** (named `JournalEntry` when this spec was written; renamed in
review because CONTEXT.md lists "entry" under Avoid):

```ts
type CriterionLine =
  | { criterion: string; scale: 'band'; band: Band; comment: string }
  | { criterion: string; scale: 'legacy'; score: number; comment: string } // n of 3
  | { criterion: string; scale: 'unknown'; raw: string };                   // shown verbatim

type JournalEntry = {
  file: string;                      // the filename, also the route param
  skill: 'schreiben' | 'sprechen';   // frontmatter `skill`, default schreiben (as patterns.ts)
  teil: 1 | 2 | 3 | null;            // frontmatter `teil`; null when missing, then no total
  date: string;                      // frontmatter `date`, ISO
  title: string;                     // first `# ` heading
  frontmatter: Record<string, string>; // words, minutes, seconds, topic, task, kept as written
  intro: string;                     // Task instruction and Leitpunkte before the first section
  criteria: CriterionLine[];         // the Total line is not kept; totals are recomputed
  criteriaAt: number;                // sections before Criteria, so it renders in file order
  categories: string[];              // frontmatter `categories`, as patterns.ts parses it
  sections: { heading: string; body: string }[]; // every `## ` section except Criteria, in file order
};
```

- `parseJournalEntry` returns null under the same rule as `parseAttemptRecord`:
  no frontmatter, or a missing or invalid `date`, or no `categories`. Null
  entries add to the "unreadable" count.
- Criteria line patterns:
  - Current: `^- \*\*(.+?)\*\* ([A-E]) \([\d,]+/\d+\) - (.*)$`
  - Legacy: `^- \*\*(.+?)\*\* ([0-3])/3 — (.*)$`
  - Any other line starting `- **` other than `- **Total**` is kept as
    `unknown`.
- **Totals are recomputed**, not read from the Total line. Schreiben uses
  `schreibenTotal(teil, criteria)` and Sprechen uses
  `sprechenTeil2Total(criteria)`, over the `band` lines only, and only when
  every expected criterion is on the band scale. Otherwise no total is shown.
  This keeps the Erfüllung-E `zeroed` flag that `TotalRow` needs. A criterion
  name outside `SCHREIBEN_CRITERIA` or `SPRECHEN_CRITERIA` is shown as text,
  never passed to `schreibenMax` or `sprechenMax`.
- Mistakes section lines reuse the `MISTAKE_LINE` shape from `patterns.ts`
  (export it rather than copy it), plus the indented explanation line under
  each. Folien lines are `- ✓|✗ **Folie n** — comment`. Better phrasings lines
  are `- **said** → **better**` plus the indented why. A line in any of these
  sections that does not match is shown as plain text, not dropped.

**Rendering of journal text:** every string from a file is rendered as a React
Native `Text` child, never as HTML or markdown. The `**` markers that the
parsers above do not consume are shown as written. The files are the learner's
own, but they can be edited by hand.

**Ordering:** newest first by `Date.parse(date)` on the list. Within a
`taskKey` group, "first" is the oldest and Versuch numbers count up from it.

**Route params** are plain filenames. `readAttemptFile` passes the name only
to `getFileHandle`, which itself rejects path separators. It also refuses
non-Attempt names, as stated in step 1.

## Testing

There is no test command, so no unit tests are added. Each step is checked with
`npx tsc --noEmit` and `npm run lint`, then by hand in Chromium against the
learner's real `journal/` folder, which today holds two legacy and one current
Sprechen entry on the same Task, plus one legacy and one current Schreiben
entry. Only step 4 needs a new Attempt: submitting the same seed Schreiben Task
twice. That uses the learner's Gemini key and writes two real journal files. If
`/tests` is run later, `history.ts` parsing is the first candidate under the
"Markdown journal formatting" rule in the coding standards.

## Notes for the AI

- Mirror `muster.tsx` for layout, `Spacing`, `MaxContentWidth`, card styling and
  `StyleSheet.create` at the bottom. Chrome is German, explanations English.
- Colour stays semantic: `bandTone` for letters, danger for "neu" categories
  and what was written, success for "weg" categories and corrections, primary
  for links and chips. Both light and dark scheme must read correctly.
- Use flat route files (`src/app/<route>.tsx`) with query params, per the
  coding standards. Do not add a `verlauf/` folder with `[datei].tsx`.
- Pass `datei`, `erst` and `spaeter` with typed `Link` `href` objects
  (`{ pathname: '/versuch', params: { datei } }`). Filenames contain only
  characters the router already encodes.
- `useLocalSearchParams` can return `string | string[]`. Take the first value.
- Reading files involves no network wait, so the plain "Lese Journal…" line
  is enough for loading, as in feature 10.
- Do not change `parseAttemptRecord` or `summarisePatterns`. The Fehlermuster
  counts must not move in step 1.
- Existing files use em dashes on purpose (and the legacy journal format
  depends on them). Do not use them in new code, comments or UI copy.
- Out of scope means out of scope: no "Nochmal versuchen" button, no delete
  button.

## Implementation notes

Changes from the spec made during the build or after `/code-review`:

- Every row on a Task with two or more Attempts links to Vergleichen. A later
  row compares Versuch 1 with itself; the Versuch 1 row compares with the
  latest. This replaces "first against latest" for every row, after the
  learner found the 04.10 row opening Versuch 3 confusing during /check.
- On `/vergleich` the chips are labelled "Versuch 1 vergleichen mit:" and
  carry each Attempt's day, and the column headings carry the day too, so the
  chips are not mistaken for the columns.
- The back link on `/versuch` and `/vergleich` is "← Zurück" and goes back in
  history, falling back to `/verlauf` when there is no history. Journal
  screens refresh on refocus without dropping to the loading state, so the
  list keeps its scroll position.
- `/vergleich` refuses a pair unless `erst` is the oldest Attempt on the Task
  and `spaeter` is a later one, so hand-edited URLs cannot mislabel Versuch
  numbers.
- `/versuch` also shows the Task instruction and Leitpunkte (`intro`) and
  minutes against the allowed time, both already in the file. Aussprache is
  set apart from the Teil 2 total, as on the live Sprechen Feedback.
- Verified so far: `npx tsc --noEmit`, `npm run lint`, a web export listing
  the three routes, and the parser run in Node over the five real journal
  files. The Chromium Done-when checks for all four steps have not been run.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15122,"specSha256":"18d674898ef88ee55be6614fb168243f0b3240ce6afdb33702838ff031a12d13","branch":"refs/heads/feature/attempt-history-in-the-app","head":"439c5cf9086fb697b840355fbacf2d4c8b9c51ed","baseRef":"refs/heads/main","baseCommit":"9c781563fe7b5e7a90c46b67dbcd264727f46263","sourceTree":"aedd312a42a6128f65b0b8d69711b8cbd401da98","absentOptional":[]} -->
