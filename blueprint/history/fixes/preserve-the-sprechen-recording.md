# Fix: Preserve the Sprechen recording

**Type:** Fix
**Status:** verified
**Branch:** fix/preserve-the-sprechen-recording

## The problem

A three-minute Sprechen take is destroyed by any of: opening Einstellungen,
reloading the page, or a failed submission. The learner has to record the whole
presentation again. Three distinct causes, all reachable from normal use.

**1. There is no route back to Sprechen.** `src/app/settings.tsx:87` has exactly
one exit link and it points at `/`, the Schreiben screen. Leaving Einstellungen
therefore always lands on Schreiben, and returning to `/sprechen` is a fresh
navigation.

**2. The recording lives only in component state.** `src/app/sprechen.tsx:39`
holds it in `useState`. On unmount the effect at `sprechen.tsx:67-70` revokes
its object URL, so both the state and the blob reference are gone. Schreiben
does not have this problem because `src/lib/draft.ts` persists the in-progress
Submission on every keystroke. Sprechen never got the equivalent, and the cost
of losing an audio Submission is far higher than losing a text one.

**3. A transient model failure is fatal.** `src/lib/gemini.ts:152` throws on any
non-OK status with no retry. A 503 "high demand" is a free-tier capacity signal,
not a bad request, and it is exactly the class that a bounded retry exists for.
Audio submissions are 5 to 6 MB and slow, so they are the most exposed.

Together these mean the learner is punished for the model being busy, which is
the opposite of what a practice tool should do.

## The fix

Persist the unsubmitted recording, give Einstellungen a way back, and retry the
transient failures. The recording work is the root-cause repair: once the take
survives, every remaining failure costs a button press instead of a
re-recording.

Constraints this must not break:

- **Object URLs must still be revoked.** The existing effect exists because
  every retake otherwise leaks one. A restored recording needs a fresh object
  URL created from the stored blob, with the same revoke discipline.
- **A finished Attempt must not be restored.** Clear the stored recording once
  feedback is saved, and when `begin()` starts a new task. Only the current
  unsubmitted take is kept, overwritten each time, never a history.
- **Storage failure must degrade, not crash.** IndexedDB is unavailable in some
  private-browsing modes. Follow the pattern in `settings.ts` and `draft.ts`:
  wrap in try/catch and carry on with the current in-memory behavior.
- **Never retry a non-transient error.** A bad key, a blocked prompt, a schema
  failure or any other 4xx except 429 must fail immediately. Retrying them
  wastes quota and delays the real error message.
- **Each retry attempt gets its own timeout.** Do not let retries stack inside
  one `AbortController` budget.

No new dependency. IndexedDB is already used by `src/lib/journal.ts`, and
`Recording` already exists in `src/lib/audio.ts`.

## Build steps

- [ ] **1. Persist and restore the recording.**
      Add `src/lib/recording-draft.ts`, mirroring the purpose of `draft.ts` but
      backed by IndexedDB because the payload is a Blob: `save(recording, task)`,
      `load()`, `clear()`. Store the WAV blob, the task, and the elapsed
      seconds. Call `save` when recording stops, `clear` when feedback is saved
      and in `begin()`. On mount, restore into the review phase when a stored
      take exists, creating a fresh object URL from the blob.
      **Done when:** record a take, reload the page, and the take is still there
      and plays; submit successfully and the stored take is gone, so a reload
      lands on the topic list rather than restoring a finished Attempt;
      `npx tsc --noEmit` passes.

- [ ] **2. Give Einstellungen a way back.**
      Return the learner to the screen they came from rather than always to `/`.
      Use the router's back behavior where there is history, keeping the link to
      `/` as the fallback for a direct load of `/settings`.
      **Done when:** from `/sprechen`, open Einstellungen, change the model, go
      back, and you are on `/sprechen` with the take intact; from `/`, the same
      round trip returns to `/`; loading `/settings` directly still offers a
      working way out.

- [ ] **3. Retry transient model failures.**
      In `generateJson`, retry on 429 and on 500, 502, 503 and 504 only, with a
      small bounded number of attempts and a backoff between them. Every other
      status, and every parse or block error, fails immediately as it does now.
      Surface the attempt number in the grading phase alongside the existing
      elapsed counter, so a retry is visibly different from a hang.
      **Done when:** a 503 no longer ends the submission on the first response;
      an invalid API key still fails immediately with its current message; the
      grading screen shows which attempt is running; `npx tsc --noEmit` passes.

## Verify

No test runner is configured, so this is checked by running the app with
`npx expo start --web` in a Chromium browser.

| Check | Expected |
|---|---|
| Record, then reload the page | Take restored, playable, still in review |
| Record, open Einstellungen, change model, go back | Back on `/sprechen`, take intact |
| Submit with a deliberately wrong API key | Immediate error, no retry delay, take still present |
| Submit and let it fail transiently | Attempt counter visible, take still present afterwards |
| Submit successfully, then reload | Topic list, no stale take restored |
| Record a second take | First take replaced, no object URL leak |
| `npx tsc --noEmit` | Passes |

The transient-failure row depends on the model actually being busy, so it may
need a retry at a peak hour. Do not fake it by pointing at a bad endpoint, since
that exercises the non-retry path instead.

## Notes

- A Flash model has more free-tier capacity than Pro or reasoning models, and
  `gemini.ts` already warns that reasoning models hit timeouts and `MAX_TOKENS`
  on this workload. Originally scoped out of this fix as a settings choice, then
  added on request once a Flash model proved to be the one that works: the
  model list now labels its top entry `Empfohlen`. The label is derived from the
  existing ranking in `gemini.ts`, not from a hardcoded id, because that ranking
  is already the reason the top entry is auto-selected.
- Feature 8, real Schreiben tasks, was parked unstarted to make room for this.
  Re-run `/feature 8` afterwards; the spec regenerates from the plans.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6621,"specSha256":"5f1ef0a22c097fb19802ad202a083911b3d904e4bb48a4c86ca7c129e9c9148a","branch":"refs/heads/fix/preserve-the-sprechen-recording","head":"c8e36c8df2c5bfb2f54eaa0c6190af07aaf557a8","baseRef":"refs/heads/main","baseCommit":"1c89890ff7a53f1d53e71568154a63579ae5c788","sourceTree":"138b0ae1cd7910937802b4d88a0c26b24f019104","absentOptional":[]} -->
