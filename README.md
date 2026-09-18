# DeutschZiel

**Lernen. Üben. Bestehen.**

A German exam-preparation tutor for learners sitting the Goethe or telc B1/B2
exam. It gives you practice tasks in the real exam format, marks what you write
and say against the criteria an examiner actually uses, corrects you at your own
level rather than rewriting you in C1 German, and keeps a journal so the
mistakes you keep making become visible instead of being forgotten.

## The idea

Preparing for a B1 exam usually means bouncing between a coursebook, a word
list, sample papers, YouTube and a general-purpose chatbot, none of which knows
what you personally keep getting wrong. DeutschZiel is meant to be the one place
where your own study material turns into structured, exam-focused practice.

The loop it is built around:

> **Learn, practise, get corrected, understand the mistake, practise again,
> become exam-ready.**

Three things make that more than a chatbot with a prompt:

**It marks the way the exam marks.** Feedback comes back as bands against the
named Goethe criteria (Erfüllung, Kohärenz, Wortschatz, Strukturen), not as a
vague impression. That is what shows you where marks are actually leaking.

**It corrects at your level.** If you write *"Ich habe gestern gegangen ins
Kino,"* the useful answer is *"Ich bin gestern ins Kino gegangen"* with an
explanation of why, not *"Gestern Abend begab ich mich ins Kino."* Every
correction comes in three tiers: **Correct** is your sentence minimally
repaired, **Simpler** is how a confident B1 speaker would naturally say it, and
**More advanced** deliberately reaches above your target level and is labelled
as a stretch rather than as the expected answer. The official B1 Wortliste is
used as the vocabulary ceiling for the first two tiers, which is also what
defines the third by exclusion.

**It counts mistakes so patterns appear.** Every error is tagged with exactly
one label from a closed list (`case-after-preposition`, `verb-final`,
`perfekt-auxiliary`, and so on). The list is closed on purpose: free-form labels
cannot be counted, because the same underlying problem comes back under a
different name each time and nothing ever appears to recur. Closed labels mean
you can see that you have made the same mistake eleven times this month.

## The end goal

Full coverage of all four exam skills (Lesen, Hören, Schreiben, Sprechen) with
your own textbooks and sample papers as the knowledge base, adaptive difficulty
tracked separately per skill, mock exams, and a readiness indicator. The full
plan lives in [`project-list.md`](project-list.md).

Two deliberate limits on that ambition:

- A readiness percentage is an internal progress indicator, not a prediction of
  passing. There is no exam-outcome data to calibrate it against, and it should
  never be presented as though there were.
- Corrections are explained rather than presented as absolute truth. They come
  from a language model and can be wrong.

## Where it is now

The project is split into a **v0** and a **v1**, and the reasoning is recorded
in [ADR 0001](docs/adr/0001-v0-v1-split.md). The short version: the author sits
Goethe B1 in a matter of weeks, and the full plan's first phase spends that
entire window on ingestion and retrieval infrastructure, which is the least
exam-relevant part of the document. So v1 is frozen until after the exam, and
what exists today is v0: a small, deliberately throwaway personal study tool.

The failure mode that split exists to prevent is not a bad app. It is that
building the app feels productive enough to replace studying. **Building is not
studying.**

### Working now

- **Schreiben.** Pick a Goethe B1 Teil 1-3 Aufgabe or generate a new one, write
  it under a timer, and submit it for marking. The draft is saved on every
  keystroke, so a reload cannot cost you a timed text.
- **Feedback.** Criterion bands, the three correction tiers, and every
  individual mistake with its span, its fix, its category and an explanation in
  English.
- **Sprechen Teil 2.** The five-Folie presentation: choose a topic, prepare,
  record in the browser, and get the same kind of assessment back from the
  audio.
- **Journal.** Every attempt is written to disk as a Markdown file, and the
  recurring mistake counts are read back across attempts.
- **Settings.** Your own API key, runtime model discovery, a Wortliste toggle
  for when free-tier token limits bite, and journal folder selection.

### Not built yet

Lesen, Hören, Sprechen Teil 1 and Teil 3, retrieval over your own textbooks,
accounts, and any kind of backend. The current build plan is in
[`blueprint/build-plan.md`](blueprint/build-plan.md).

## Running it

v0 is web only and runs locally. It is not deployed anywhere.

```bash
npm install
npx expo start --web
```

Then open Settings in the app and paste your own [Google AI Studio API
key](https://aistudio.google.com/apikey). The key is stored in your browser and
is sent only to Google.

Use a Chromium browser. Recording uses `MediaRecorder` and the journal uses the
File System Access API, which is Chromium only; elsewhere each attempt falls
back to a file download.

## How it is built

| | |
|---|---|
| App | Expo with expo-router, React Native, React 19, TypeScript in strict mode |
| Model | Gemini, called over REST straight from the browser |
| Storage | `localStorage` for settings and the draft, Markdown files on disk for attempts |
| Backend | None |

There is no server, no database, no accounts and no retrieval in v0, and that is
a decision rather than a gap. Each learner supplies their own API key, which is
why no server holds a secret, and why this app must never be deployed with a key
bundled into it. Attempts are files rather than rows because the tool is
expected to be discarded; the thing meant to survive into v1 is the correction
prompt, refined against several weeks of real writing and real errors.

## Repository layout

```
src/app/          screens (expo-router file-based routes)
src/lib/          the non-UI logic: Gemini client, prompts, taxonomy, journal, audio
src/components/   shared UI
docs/adr/         architecture decisions
blueprint/        the build workflow: plans, standards, feature specs, history
CONTEXT.md        the domain glossary, binding for naming
project-list.md   the full v1 plan
```

Two directories are intentionally absent from the repository. `journal/` holds
personal writing, and `Resources/` holds copyrighted coursebooks and exam papers
that are not redistributed. Both are gitignored.

## A note on the exam material

Official Goethe sample papers and exam information are used as a reference for
format and difficulty, not copied out. Coursebooks stay on the machine of the
person who owns them. Generated practice material is original, produced in the
shape of the real tasks.
