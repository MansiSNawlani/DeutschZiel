# Feature: Verify the scoring against the official Bewertungskriterien

**From build-plan:** feature 9
**Build attempt:** 1
**Branch:** feature/verify-the-scoring-against-the-official-bewertungskriterien
**Status:** verified

## Goal

Make the Feedback score a Submission on the scale the Goethe B1 examiner actually
uses. I checked the published papers while writing this spec. They show that two
of the three things this item was meant to confirm are wrong in the app:

| What | App today | Official papers | Verdict |
| --- | --- | --- | --- |
| Criterion scale | 0-3 bands, 4 levels | A-E, 5 levels, each worth points | **Wrong** |
| Erfüllung = E | no special rule | the whole Aufgabe scores 0 | **Missing** |
| Sprechen Teil 2 Folien | paraphrased wording | fixed wording on the Kandidatenblatt | **Wrong** |
| Schreiben timings | 20 / 25 / 15 min, 60 total | 20 / 25 / 15 min, 60 total | Correct |
| Schreiben word targets | 80 / 80 / 40 | circa 80 / 80 / 40 | Correct |
| Sprechen Teil 2 length | 180 s | circa drei Minuten | Correct |

The fix is to switch the bands to A-E, put the official descriptors in front of
the model, show each band's points and an Aufgabe total, and use the exact
Folien wording. Timings and word targets only need their "unverified" comments
removed.

Sources (both Erwachsene, per the adult Goethe B1 target):

- `Resources/B1_Uebungssatz_Erwachsene.pdf`: Bewertungskriterien Schreiben
  (printed p. 42) and Sprechen (p. 46); Bewertungsbogen Schreiben (p. 44) and
  Sprechen (p. 48); Folien (Sprechen Teil 2 Kandidatenblatt).
- `Resources/b1_modellsatz_erwachsene.pdf`: the same Bewertungskriterien
  (pp. 42, 46) and Folien (pp. 27-28). Read only to confirm they are the same.
  None of its Tasks enter the app.

## In scope

- A new `src/lib/bewertung.ts` holding the A-E band type, the official points
  per band for each criterion, the Aufgabe total with the Erfüllung-E rule, and
  the official descriptors as prompt text.
- `CriterionScore.band` and the Sprechen criteria change from `number` to the
  band letter, and both Gemini response schemas ask for the letter.
- The Schreiben and Sprechen system prompts get the official descriptors in
  place of the current one-line paraphrases.
- The Schreiben user prompt says outright when the Submission is under 50 % of
  the target length, because the official E descriptor for Erfüllung is
  "Textumfang weniger als 50 % der geforderten Wortanzahl".
- Both Feedback screens show the letter, its points, and the Aufgabe (or Teil)
  total. The "Bands are an approximation" caveat is removed.
- Journal entries write the letter, the points and the total.
- `FOLIEN` uses the official wording.
- The "unverified" or "item 9" comments in `types.ts`, `speaking.ts` and
  `tasks.ts` are removed or corrected.

## Out of scope

- Migrating existing journal entries. Entries written before this feature keep
  their `2/3` lines. v0 is throwaway, and nothing reads criteria back yet.
- Sprechen Teil 1 and Teil 3 (Interaktion, Rückmeldung). The app practises only
  Teil 2.
- A module-level result or pass/fail verdict. The 60-point pass mark applies to
  a whole Module, and one Aufgabe cannot show it. The Aufgabe total is shown
  without a verdict.
- Overriding the model's band in code. The model returns the band. Code only
  converts it to points and applies the E rule to the total.
- Changing the Error category list, the Correction tiers or the timer.
- Regenerating `project-overview.md`. Its "Scoring bands are unverified" open
  item becomes stale. Run `/overview` after `/complete`.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then one review packet at
the end. `checkpointCommits` is disabled, so `/complete` makes the only commit.

## Build steps

- [x] **1. Bewertung module and Schreiben scoring end to end.**
  Add `src/lib/bewertung.ts` (contract below). Retype `CriterionScore.band` in
  `types.ts` and drop its "approximation" comment. In `prompts.ts`, change the
  `FEEDBACK_SCHEMA` band to a `STRING` enum of `A`-`E`. Replace the CRITERIA
  section of `buildSystemPrompt` with the official Schreiben descriptors, with
  the Erfüllung row for each Aufgabe, and state the E rule. In
  `buildUserPrompt`, add a line when `wordCount < 0.5 * task.targetWords`. In
  `feedback-view.tsx`, replace `Bands` with a five-segment bar plus `B · 7,5/10`,
  add an Aufgabe total line (`Aufgabe 1: 27,5 / 40`), and remove the caveat.
  In `journal.ts` `formatAttempt`, write `- **Erfüllung** B (7,5/10) - comment`
  and a total line.
  *Done when:* `npx tsc --noEmit` and `npm run lint` pass, and a submitted
  Aufgabe 1 in Chromium shows letters, points and a `/ 40` total. A Submission
  under 40 words for Aufgabe 1 comes back with Erfüllung E and the total shows
  0. The journal file shows the new criteria lines.

- [x] **2. Sprechen Teil 2 scoring and Folien wording.**
  In `speaking.ts`, replace `FOLIEN` with the official five instructions
  (below). Retype the `SpeakingFeedback.criteria` band. Change the
  `SPEAKING_SCHEMA` band to the letter enum. Replace the CRITERIA paragraph of
  `buildSpeakingSystemPrompt` with the Teil 2 descriptors. Erfüllung is defined
  by how many Folien were covered: A all 5, B 3-4, C 2 or all too brief, D 1,
  E not assessable. Add the Aussprache descriptors. Remove the header's "Verify
  the Folien wording" paragraph. In `sprechen.tsx`, render the letter, points
  and a Teil 2 total out of 40, with Aussprache shown separately out of 16 and
  labelled as judged across the whole Module. In `journal.ts`
  `formatSpeakingAttempt`, write the same line format.
  *Done when:* tsc and lint pass, and the Sprechen screen lists the five
  official Folien. A recorded presentation in Chromium shows letters, points, a
  `/ 40` Teil 2 total and a separate Aussprache `/ 16`. The journal file shows
  the new lines.

- [x] **3. Timings and word targets: record the confirmation.**
  No value changes. In `tasks.ts`, replace "checking them against the
  Bewertungskriterien is build-plan item 9" with a note that 20/25/15 minutes
  and circa 80/80/40 words match the Übungssatz and Modellsatz. Check every
  other comment the earlier grep found and fix any that still says
  "approximation" or "unverified".
  *Done when:* `grep -rniE "approximation|item 9|verify the folien" src` returns
  nothing, and tsc and lint pass.

### Addendum: two fixes found during /check, added at the user's request

- [x] **4. Journal filenames to the second.** `fileNameFor` and
  `saveSpeakingAttempt` stamped only to the minute, and `writeFile` overwrites.
  A second Attempt on the same Task within a minute replaced the first. Both
  now share `fileStamp`, which adds seconds.
  *Done when:* two Attempts on the same Task a few seconds apart produce two
  journal files. Observed: `...-122327-...` and `...-122336-...`.

- [x] **5. Feedback addresses the learner as "you".** A live Sprechen run said
  "her presentation", because the prompt calls the learner "the candidate" and
  never says how to address them. Both system prompts now tell the model to
  write "you" and never use the third person.
  *Done when:* both system prompts carry the rule (observed in the captured
  requests) and a live run's comments say "you".

## Files / areas

- `src/lib/bewertung.ts` (new)
- `src/lib/types.ts` - `CriterionScore`
- `src/lib/prompts.ts` - `FEEDBACK_SCHEMA`, `buildSystemPrompt`, `buildUserPrompt`
- `src/lib/speaking.ts` - `FOLIEN`, `SpeakingFeedback`, `SPEAKING_SCHEMA`,
  `buildSpeakingSystemPrompt`, header comment
- `src/components/feedback-view.tsx` - `Bands`, caveat, total
- `src/app/sprechen.tsx` - BEWERTUNG card (around line 447)
- `src/lib/journal.ts` - criteria lines in both formatters (lines 163, 291)
- `src/lib/tasks.ts` - header comment only

## Data / contracts

**Band:** `type Band = 'A' | 'B' | 'C' | 'D' | 'E'`. A is best. This replaces
`band: number` everywhere.

**Points per band**, from the Übungssatz Bewertungsbogen (A / B / C / D / E):

| Module | Teil | Criterion | Points |
| --- | --- | --- | --- |
| Schreiben | 1, 2 | Erfüllung, Kohärenz, Wortschatz, Strukturen | 10 / 7,5 / 5 / 2,5 / 0 each (40) |
| Schreiben | 3 | Erfüllung, Kohärenz | 4 / 3 / 2 / 1 / 0 each |
| Schreiben | 3 | Wortschatz, Strukturen | 6 / 4,5 / 3 / 1,5 / 0 each (Teil 3 = 20) |
| Sprechen | 2 | Erfüllung, Wortschatz, Strukturen | 12 / 9 / 6 / 3 / 0 each |
| Sprechen | 2 | Kohärenz | 4 / 3 / 2 / 1 / 0 (Teil 2 = 40) |
| Sprechen | 1-3 | Aussprache | 16 / 12 / 8 / 4 / 0 (whole Module) |

Each Schreiben total adds up to 100 (40 + 40 + 20). The Sprechen Bewertungsbogen
also adds up to 100 (Teil 1 28, Teil 2 40, Teil 3 16, Aussprache 16).

**E rule:** when Erfüllung is E, that Aufgabe or Teil totals 0 whatever the
other bands are. Aussprache is not part of the Teil 2 total, so this rule does
not change it.

**`bewertung.ts` exports** (names are the implementer's to tighten):

- `Band`, `BANDS`
- `criterionPoints(module, teil, criterion, band): number`
- `aufgabeTotal(module, teil, criteria): { points: number; max: number }`,
  which applies the E rule
- `formatPoints(n): string`, a German decimal comma (`7,5`)
- `SCHREIBEN_KRITERIEN` and `SPRECHEN_TEIL2_KRITERIEN`, the descriptor text for
  the prompts

**Band colour:** A and B use `success`, C uses `warning`, D and E use `danger`.
The 60 % pass mark falls between B (75 %) and C (50 %), so the colour shows
which side of it each criterion is on.

**Official Folien**, verbatim from both papers. Line breaks on the sheet are
joined into one line:

1. Stellen Sie Ihr Thema vor. Erklären Sie den Inhalt und die Struktur Ihrer Präsentation.
2. Berichten Sie von Ihrer Situation oder einem Erlebnis im Zusammenhang mit dem Thema.
3. Berichten Sie von der Situation in Ihrem Heimatland und geben Sie Beispiele.
4. Nennen Sie die Vor- und Nachteile und sagen Sie dazu Ihre Meinung. Geben Sie auch Beispiele.
5. Beenden Sie Ihre Präsentation und bedanken Sie sich bei den Zuhörern.

**Descriptors:** copy the German descriptors from the Bewertungskriterien pages
word for word, column by column, and put them in the prompt as they are. The
prompt's own instructions stay in English, and comments in the Feedback stay
in English. On the sheet, Aufgabe 2 and 3 say "Wie Aufgabe 1" for Kohärenz,
Wortschatz and Strukturen. In the prompt, repeat Aufgabe 1's descriptors there
instead of writing "Wie Aufgabe 1".

**Journal line format:** `- **<criterion>** <letter> (<points>/<max>) - <comment>`,
then `- **Total** <points> / <max>`. Earlier entries keep their `n/3` lines.

## Testing

There is no test command, so no unit tests are added. Each step is checked with
`npx tsc --noEmit` and `npm run lint`, then by hand in Chromium with the
learner's own Gemini key, as each step's Done when describes. Those manual runs
are the only live evidence this feature gets. `/check` or `/check guide` can
repeat them.

## Notes for the AI

- I read the points table with `pdftotext -layout`, because no PDF renderer is
  installed here. The row order comes from where the values sit vertically on
  the Bewertungsbogen. Before coding the table, open the Übungssatz pp. 44 and
  48 and check the Teil 3 split (Erfüllung and Kohärenz worth 4, Wortschatz and
  Strukturen worth 6) and Sprechen Teil 2 Kohärenz worth 4. If either is
  different, follow the page and say so in the review packet.
- The Modellsatz is held back from practice. Reading its Bewertungskriterien to
  confirm they match the Übungssatz is fine. Copying its Tasks or Folien topics
  into the app is not.
- `buildSystemPrompt` is the artifact v0 exists to refine. Change only the
  CRITERIA section and leave the rewrite, mistake and Wortliste sections as
  they are.
- In the Sprechen screen, keep Aussprache visibly apart from the Teil 2 total.
  Folding its 16 points into a "/ 56" figure would be a number the exam never
  produces.
- Item 12 (Attempt history) will later parse journal criteria lines and must
  accept both the old `n/3` format and the new one. Do not build that parser
  here.
- Existing files use em dashes on purpose. Do not use them in new code,
  comments or prompt text.
