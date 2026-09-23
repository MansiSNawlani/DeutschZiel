# DeutschZiel - Project Overview

<!-- blueprint:source-hash 94998e0260e0ae162004fb31cfb97534f80eff126b33dd177c491d3f07ce7408 -->

> A German exam-preparation tutor that marks Schreiben and Sprechen the way a
> Goethe examiner does, corrects at the learner's own level, and journals
> mistakes so recurring patterns become visible.

**Scope note.** This overview describes **v0**, the five-week personal study
tool. v1 is frozen until after the exam and lives in `project-list.md`. See
`docs/adr/0001-v0-v1-split.md`. `CONTEXT.md` is binding for naming.

## Problem

Preparing for the Goethe-Zertifikat B1 means bouncing between a coursebook, a
word list, sample papers and a general-purpose chatbot, none of which knows what
the learner keeps getting wrong. Generic tools also correct in the wrong
register, answering an A2/B1 mistake with a C1 rewrite that teaches nothing.
What is missing is feedback scored against the criteria the exam actually uses,
pitched at the learner's level, and recorded so repeated mistakes can be counted
rather than forgotten.

## Users

- **Learner (v0)** - the author alone, sitting Goethe B1 in roughly five weeks.
  Needs fast, honest, exam-shaped feedback and a record of it.
- **Learner (v1)** - a closed, manually invited group of friends sitting Goethe
  or telc B1/B2 in 2027. Out of scope now.

No access tiers, no accounts, no sign-up. The app is single-user by
construction: there is nobody else to be, because there is no server.

## Usage model

- **Scale:** one learner. Roughly five to fifteen in v1.
- **Reachability:** local only. Not deployed, not internet-facing.
- **Trust:** a single trusted user running the app against their own API key. No
  untrusted input, no shared persisted data, no multi-tenancy.
- **The one real constraint:** the Gemini key lives in browser storage and must
  never be committed, bundled, or defaulted. `journal/` and `Resources/` stay
  gitignored, the first because the repository is public and the writings are
  personal, the second because the coursebooks are copyrighted.
- **Explicit non-requirements:** auth, multi-user support, a database,
  retrieval, compliance, availability targets, native iOS and Android builds.

## Features

Build-plan order, with the build-plan ID kept verbatim. Items 1 to 6 are
shipped; **8 is next**. There is no item 7: it asked for Sprechen Teil 2 to be
reviewed against the running app, which is a verification and a decision rather
than something to build, so it was removed from the list `/feature` reads. The
gap is deliberate, because feature IDs are stable.

- **1. Bring-your-own-key settings** - the learner's own Gemini key, runtime
  model discovery, Wortliste toggle, journal folder selection. *Shipped.*
- **2. Schreiben practice loop** - choose or generate a Teil 1-3 Aufgabe, write
  it under a timer, submit it. *Shipped.*
- **3. Tiered correction feedback** - criterion bands, the three rewrites, and
  individually categorised mistakes. **Headline feature**, and per ADR 0001 the
  correction prompt behind it is the one artifact expected to survive into v1.
  *Shipped.*
- **4. Attempt journal on disk** - each Attempt written as Markdown, with
  Mistake pattern counts folded across Attempts. *Shipped.*
- **5. Draft persistence** - Task and text saved on every keystroke, so a reload
  cannot cost a timed Aufgabe. *Shipped.*
- **6. Sprechen Teil 2** - the five-Folie presentation, recorded in the browser
  and assessed from the audio. *Shipped.*
- **8. Real Schreiben tasks from the official papers** - replace placeholder
  seed Tasks with ones derived from the Übungssatz, holding the Modellsatz back
  for cold timed mocks. **Next.**
- **9. Verify the scoring against the official Bewertungskriterien** - confirm
  the 0-3 band boundaries, the Folien wording, and task timings and word
  targets.
- **10. Mistake pattern view** - which Error categories actually recur across
  Attempts, and their trend, not just the counts from a single Attempt.
- **11. Re-decide the six-hour cap** - after a week of real use, extend or stop.

## Data model

No database. Three stores: two `localStorage` keys and a folder of Markdown
files. The shapes below are locked, because the journal on disk already holds
Attempts written against them.

### Settings - `localStorage["deutschziel.settings.v1"]`

- `apiKey` (string) - the learner's own Gemini key. Never leaves the browser
  except to Google.
- `model` (string) - a model id discovered at runtime from the key, not
  hardcoded.
- `useWortliste` (boolean) - send the full B1 Wortliste as the vocabulary
  ceiling. The largest part of a prompt, so it is switchable when free-tier
  token limits bite.

### Draft - `localStorage["deutschziel.draft.v1"]`

- `task` (Task) - stored whole, not by id, because a generated Task exists
  nowhere to look up.
- `text` (string), `elapsed` (number, seconds), `savedAt` (ISO string)

### Task

- `id` (string), `teil` (1 | 2 | 3), `title` (string)
- `instruction` (string) - what the learner reads, in German, as the exam
  presents it
- `points` (string[]) - the Leitpunkte; Erfüllung is scored against these
- `register` ('informell' | 'formell'), `targetWords` (number), `minutes` (number)
- `source` ('seed' | 'generated' | 'modellsatz')

### Feedback

- `criteria` (CriterionScore[]) - one per named Goethe criterion
- `tiers` (CorrectionTiers) - `correct`, `simpler`, `advanced`
- `mistakes` (MistakeInstance[])
- `summary` (string) - two sentences, English, what to do differently next time

**CriterionScore:** `criterion` ('Erfüllung' | 'Kohärenz' | 'Wortschatz' |
'Strukturen'), `band` (0-3), `comment` (string).

**MistakeInstance:** `span` (string, the learner's own words quoted exactly so
the UI can locate it), `correction` (string), `category` (ErrorCategoryId),
`explanation` (string, English).

### Attempt - one Markdown file per Attempt in `journal/`

- `id` (string), `task` (Task), `submission` (string), `feedback` (Feedback)
- `wordCount` (number), `secondsSpent` (number, advisory against `Task.minutes`)
- `createdAt` (ISO string)
- Filename: `<timestamp>-<task.id>.md`, or `<timestamp>-sprechen-<task.id>.md`

### SpeakingTask and SpeakingFeedback

**SpeakingTask:** `id`, `topic` (string), `targetSeconds` (number, 180 for the
real Teil 2), `source` ('seed' | 'generated').

**SpeakingFeedback:** `transcript` (string), `folien` (FolieCoverage[]),
`criteria`, `mistakes` (SpokenMistake[]), `betterPhrasings` ({ said, better, why
}[]), `summary`.

> `transcript` is a calibration check, not decoration. If it reads cleaner than
> what the learner actually said, the model repaired the German on the way in
> and every grammar judgement below it is unreliable.

**FolieCoverage:** `folie` (number 1-5), `covered` (boolean), `comment`.
**SpokenMistake:** `said`, `correction`, `category` (ErrorCategoryId),
`explanation`.

### ErrorCategoryId - a closed list

Twenty-eight ids in five groups (verb, nominal, sentence, lexis, register and
task), defined in `src/lib/taxonomy.ts` and specified in `CONTEXT.md`.

> **Locked.** The list is closed on purpose: free-form labels cannot be counted,
> because the same problem returns under a different name and nothing appears to
> recur. Adding a category invalidates the counts in existing journal entries.
> Pronunciation and fluency are deliberately absent until it is measured whether
> they survive into what the model receives at all.

### Wortliste

2740 headwords as a JSON string array, extracted from the published Goethe B1
list. Not reference material but a constraint: it is the vocabulary ceiling for
the Correct and Simpler tiers, and by exclusion it defines More advanced.

### Mistake pattern - `journal/mistakes.md`

Error category counts folded across all Attempt files. Derived, not authored;
rebuilt as Attempts accumulate.

## Tech stack

- **Expo with expo-router** - the app shell and file-based routing. Typed routes
  are on.
- **React Native 0.86 / React 19** - UI, with `StyleSheet` and a semantic colour
  palette. No Tailwind, no styling library.
- **TypeScript, strict** - `type` aliases over interfaces, `@/` aliased to `src/`.
- **Gemini over REST** - called straight from the browser with the learner's own
  key, asking for structured output against an explicit response schema.
- **Browser platform APIs** - `MediaRecorder` for Sprechen, the File System
  Access API plus IndexedDB for the journal, `localStorage` for settings and
  draft. All Chromium-first, with a download fallback where the journal is
  unavailable.
- **No backend, no database, no accounts, no retrieval.** A decision, not debt.

## Monetization

Not in v1. A personal tool, then a closed friends group. No licensing,
monetization or GDPR programme in scope. The only cost constraint that matters
is staying inside the Gemini free tier.

## UI/UX

The loop is the same everywhere: **Aufgabe, Antwort, Korrektur, Erklärung,
weiter.**

- `/` - Schreiben. Task choice, the timed editor, then Feedback.
- `/sprechen` - Sprechen Teil 2. Topic choice, preparation, recording, review,
  then Feedback.
- `/settings` - key, model, Wortliste toggle, journal folder.

Conventions:

- Exam content and chrome in German; mistake explanations in English, so the
  rule is read in a language the learner already has.
- Colour is semantic, never decorative. Success is the Correct tier and a full
  band, primary is the Simpler tier and anything navigable, accent is the More
  advanced tier, warning is over time or over length, danger is a Mistake
  instance or a failing band.
- Feedback leads with criterion bands, because with an exam close those show
  where marks are leaking fastest. The tiered rewrite sits below as the slower,
  better learning artifact.
- Light and dark both first class, following the system scheme.
- Long waits show an elapsed second counter. A bare spinner cannot be told apart
  from a hang, and slow free-tier responses are normal.

## Deployment

**v0 is not deployed.** It runs locally with `npx expo start --web` on port
8081. A static web export (`npx expo export --platform web`, output `dist/`)
exists as a capability but is not published anywhere.

- No env vars. The API key is entered in the app and held in browser storage.
- No database, no workers, no cron, no health check path.
- **Hard rule:** never deploy with a key bundled in. The bring-your-own-key
  design exists so no server holds a secret.

> TODO: whether v0 should ever be exported and hosted, or stay strictly local
> for the five weeks.

v1's targets are already decided in ADR 0001 and are out of scope here: Google
Cloud Run, Supabase free tier for Postgres and pgvector, the paid Gemini tier
once other people's data is involved, magic-link auth against a manual
allowlist.

## Open questions

- **Build items 8 to 11 are inferred**, from the code and ADR 0001, not from a
  roadmap the user stated. Confirm or replace them.
- **Sprechen Teil 2 is unreviewed.** It ships but has not been run end to end
  against the real app. The check that matters is whether `SpeakingFeedback.
  transcript` reads cleaner than what was actually said, because if the model
  repairs the German on the way in, every judgement below it is unreliable.
  Handled by `/check guide` then `/fix`, not by a build-plan item.
- **Sprechen Teil 1 and Teil 3 are absent** from the build plan. They need a
  simulated Partner, which was assumed out of scope for five weeks. Confirm.
- **A stale comment contradicts the plan.** `src/lib/tasks.ts` says the official
  papers "are not in `Resources/` yet"; `Resources/` now holds both the
  Modellsatz and the Übungssatz. Build item 8 exists because of this.
- **Deployment of v0 is undecided.** See the TODO above.
- **Scoring bands are unverified.** `src/lib/types.ts` calls the 0-3 bands an
  approximation until checked against the Bewertungskriterien, and
  `src/lib/speaking.ts` says the same about the Folien wording. Build item 9.
