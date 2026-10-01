# Feature: Real Schreiben tasks from the official papers

**From build-plan:** feature 8
**Build attempt:** 1
**Branch:** feature/real-schreiben-tasks-from-the-official-papers
**Status:** verified

## Goal

Replace the three placeholder Schreiben Tasks in `src/lib/tasks.ts` with the
three real Aufgaben from the official Goethe B1 Übungssatz, so that practice and
generated variations both start from exam-accurate material. The Modellsatz stays
out of the app on purpose, reserved for cold timed mocks in the final fortnight.

## In scope

- Transcribe Schreiben Aufgabe 1, 2 and 3 from
  `Resources/B1_Uebungssatz_Erwachsene.pdf` (page 24) into `SEED_TASKS`.
- Correct the stale file comment in `src/lib/tasks.ts`, which claims the official
  papers "are not in `Resources/` yet". They are.
- Correct the user-facing note under the task list on `/`, which tells the
  learner these three are placeholders and to replace them with the Modellsatz.
- Keep the generator working: `buildTaskPrompt` uses these Tasks as few-shot
  exemplars, so the new content becomes the shape every generated Aufgabe copies.

## Out of scope

- The Modellsatz. No Modellsatz task enters the app in this feature, and no code
  reads `source: 'modellsatz'` yet. That is the point of holding it back.
- The Jugendliche papers, unless the Open question below changes the target exam.
- Verifying the 0-3 criterion bands, the Bewertungskriterien wording or the
  Sprechen Folien. That is build-plan item 9.
- Sprechen topics in `src/lib/speaking.ts`. Item 8 is Schreiben only.
- Any change to the `Task` type, the journal format, or draft storage.
- Refreshing `blueprint/context/project-overview.md`, whose Known gaps section
  mentions the stale comment. Regenerating the overview belongs to `/overview`
  after this feature completes.

## Build loop

`workflow.stepReview` is `feature`, so both steps are implemented in sequence and
reviewed together in one packet at the end. `workflow.checkpointCommits` is
`disabled`, so there are no per-step commits. `/complete` creates the single
feature commit.

## Build steps

- [x] **1. Replace the seed Tasks with the Übungssatz Aufgaben.**
  Rewrite `SEED_TASKS` in `src/lib/tasks.ts` with the three Tasks specified under
  Data / contracts, and replace the file header comment with accurate provenance:
  which paper and page the text comes from, why `source` stays `'seed'`, why the
  Modellsatz is deliberately absent, and which `points` entries are derived
  rather than printed on the paper.
  *Done when:* `npx tsc --noEmit` and `npm run lint` both pass, and on
  `npx expo start --web` in Chromium the task list shows the three official
  Aufgaben with `~80 Wörter · 20 Min · informell`, `~80 Wörter · 25 Min ·
  informell` and `~40 Wörter · 15 Min · formell`. Opening Aufgabe 2 shows the
  Gästebuch quote above the editor on its own lines, not as one run-on paragraph,
  and the timer starts at 25 minutes.

- [x] **2. Correct the note under the task list.**
  Replace the paragraph at `src/app/index.tsx:326-330` so that it states what is
  now true: these are the Übungssatz Aufgaben, the generator copies their format,
  and the Modellsatz is held back for cold timed mocks. Keep it to one short
  paragraph in the existing `type="small" themeColor="textSecondary"` style.
  *Done when:* `npx tsc --noEmit` and `npm run lint` pass, and the note on `/` no
  longer calls the tasks placeholders and no longer tells the reader to fetch the
  Modellsatz.

## Files / areas

- `src/lib/tasks.ts` - `SEED_TASKS` and the header comment. `taskById` is
  unchanged and currently has no caller.
- `src/app/index.tsx:326-330` - the note under the task list. Nothing else
  changes here: the picker at line 294 and the writing screen at line 355 already
  render `instruction` and `points` generically.
- `Resources/B1_Uebungssatz_Erwachsene.pdf` page 24 - the source, read only.
- Not changed: `src/lib/types.ts`, `src/lib/prompts.ts`, `src/lib/journal.ts`,
  `src/lib/draft.ts`, `src/lib/speaking.ts`.

## Data / contracts

The `Task` shape is unchanged: `id`, `teil`, `title`, `instruction`, `points`,
`register`, `targetWords`, `minutes`, `source`.

`source` stays `'seed'` for all three. In this codebase `'seed'` means "ships in
`tasks.ts`" as opposed to `'generated'`, which is exactly what these are. No new
union member is added, because nothing reads `source` today: `journal.ts` writes
`id`, `teil`, `title`, `instruction` and `points` only, and `'modellsatz'` stays
reserved for the held-back cold mocks.

Transcribe the German verbatim from the paper. Normalize the `fl` ligature in
"flexibler" to plain ASCII letters, and keep the German typographic quotes
`„ ... "` already used elsewhere in the file.

**Aufgabe 1** - `id: 'ue-erw-t1-online-lernen'`, `teil: 1`,
`title: 'Aufgabe 1 — E-Mail über das Online-Lernen'`, `register: 'informell'`,
`targetWords: 80`, `minutes: 20`.
`instruction`: the situation line "Sie haben online Deutsch gelernt und berichten
Ihrer Freundin/Ihrem Freund darüber.", then the paper's structure line "Achten
Sie auf den Textaufbau (Anrede, Einleitung, Reihenfolge der Inhaltspunkte,
Schluss)." on its own line.
`points`, printed on the paper as three bullets:
1. `Beschreiben Sie: Wie haben Sie gelernt?`
2. `Begründen Sie: Welche Vorteile hat das Lernen mit dem Computer?`
3. `Machen Sie einen Vorschlag für ein Treffen.`

**Aufgabe 2** - `id: 'ue-erw-t2-feste-arbeitszeiten'`, `teil: 2`,
`title: 'Aufgabe 2 — Forumsbeitrag zu Arbeitszeiten'`, `register: 'informell'`,
`targetWords: 80`, `minutes: 25`.
`instruction` carries the stimulus, because the task cannot be answered without
it and the `Task` type has no separate stimulus field: the situation ("Sie haben
im Fernsehen eine Diskussionssendung zum Thema „Feste Arbeitszeiten" gesehen. Im
Online-Gästebuch der Sendung finden Sie folgende Meinung:"), a blank line, the
attributed quote ("Jessica, 05.01. 17:23 Uhr" plus her guestbook post verbatim),
a blank line, then "Schreiben Sie nun Ihre Meinung zum Thema."
The paper prints no Leitpunkte for this Aufgabe, so `points` is derived and must
be marked as derived in the file comment:
1. `Nennen Sie Ihre Meinung zum Thema.`
2. `Begründen Sie Ihre Meinung.`

**Aufgabe 3** - `id: 'ue-erw-t3-kurs-absage'`, `teil: 3`,
`title: 'Aufgabe 3 — Absage an den Kursleiter'`, `register: 'formell'`,
`targetWords: 40`, `minutes: 15`.
`instruction`: "Sie haben sich für den Kurs „Erfolgreich präsentieren"
angemeldet. Zu dem ersten Termin können Sie aber nicht kommen.", a blank line,
"Schreiben Sie an Ihren Kursleiter, Herrn Weber.", then "Vergessen Sie nicht die
Anrede und den Gruß am Schluss."
`points` are split from the paper's own imperative sentence, so they are close to
printed but are not bulleted there. Mark them as derived too:
1. `Entschuldigen Sie sich höflich.`
2. `Berichten Sie, warum Sie nicht kommen können.`

Downstream consequences, all intended:

- `buildTaskPrompt` asks the model for exactly `shape.points.length` Leitpunkte,
  so generated Teil 2 and Teil 3 Aufgaben now get two rather than three. That
  matches the real papers.
- New journal filenames use the new ids. Existing journal files keep their old
  `seed-t1-umzug` style ids, which is correct: they record different Tasks.
- A draft saved before this change still restores, because `draft.ts` stores the
  whole `Task` rather than an id to look up.

## Verification record

Automated, run on this branch after both steps:

- `npx tsc --noEmit` - **passes**, no output.
- `npm run lint` - **fails with 6 errors, all pre-existing.** The identical 6
  errors are reported on the unmodified tree (verified by stashing this work and
  rerunning): `react-hooks/set-state-in-effect` and related in
  `src/app/index.tsx:71`, `:77`, `src/app/settings.tsx:26`, `:47`,
  `src/app/sprechen.tsx:76` and `src/hooks/use-color-scheme.web.ts:11`. None are
  in the code this feature changed, and this work adds none. Repairing them is a
  separate `/fix`, not this feature.

Manual, still outstanding: the three browser checks under Testing below need a
dev server, which this step does not start. Run `npx expo start --web` in
Chromium and confirm them before `/complete`.

## Testing

No test runner is configured, so there are no unit tests in this feature.
Verification is the two `Done when` checks above plus one manual pass in
Chromium, per the browser note in `AGENTS.md`:

1. Open `/`, confirm the three Aufgaben, their word and time lines, and the
   corrected note.
2. Start Aufgabe 2, confirm the Gästebuch quote is readable above the editor and
   that the clock counts down from 25:00.
3. With a Gemini key configured, press "↻ Neue Aufgabe 2 generieren" once and
   confirm it returns a task on a different topic with two Leitpunkte and a
   `~80 Wörter · 25 Min` line. This is the one step that proves the exemplar
   change did not break generation.

## Notes for the AI

- Read the tasks from the PDF yourself before writing them. The extracted text
  under the Gästebuch shows a second timestamp, `05.01. 21:12 Uhr`, with no body:
  that is the empty slot for the learner's own post, not a second opinion to
  transcribe.
- Do not paraphrase, shorten or modernize the German. Exam-accurate wording is
  the entire value of this feature.
- Do not add Modellsatz tasks, a paper selector, a task file format or a loader.
  Three constants in one file is the whole requirement.
- Aufgabe 2's card in the picker becomes noticeably taller than the others,
  because the quote lives inside `instruction`. That is accepted. Do not truncate
  it, add a stimulus field, or introduce a collapse control.
- The repository has a public remote. Three exam tasks from a freely published
  Goethe practice paper, kept for personal study, is a small and ordinary use,
  but it is a judgement call worth naming here rather than burying.

## Open questions

- ~~Which Übungssatz is the target exam: Erwachsene or Jugendliche?~~
  **Answered at review: Erwachsene.** The learner is sitting the adult exam, so
  `Resources/B1_Uebungssatz_Erwachsene.pdf` is the source. The Jugendliche paper
  is in `Resources/` as reference material only and is not a task source.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10245,"specSha256":"90d6bfbc7a8616fe1c111a27b9d4a1bae3fb8dd22f50d77e22b6d13b981ebdca","branch":"refs/heads/feature/real-schreiben-tasks-from-the-official-papers","head":"2545d51261fbb809f6f6f065fcdaed3aa48e4253","baseRef":"refs/heads/main","baseCommit":"2545d51261fbb809f6f6f065fcdaed3aa48e4253","sourceTree":"c56f5b4587eaa77b959852529ee81e1e528f5701","absentOptional":[]} -->
