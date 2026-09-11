# Split DeutschZiel into a five-week personal v0 and a post-exam v1

Date: 2026-09-10

The author sits Goethe-Zertifikat B1 in roughly five weeks; the friends this app is otherwise for sit theirs in 2027. The full plan in `project-list.md` is a three-to-six month build whose first phase — ingestion, chunking, embeddings, retrieval, auth — produces a chat interface over a textbook, which is the least exam-relevant feature in the document. We are therefore building two things on two timelines: **v0**, a deliberately throwaway personal study tool capped at roughly six hours of work, and **v1**, the document as written, frozen until after the exam.

## Considered options

Building the documented phases in order was the obvious alternative, accepting that this exam gets prepared for with PDFs and a general-purpose chatbot. It was rejected because the five-week window is the only one that matters for the author, and Phase 1 spends all of it on the wrong things.

The failure mode this decision exists to prevent is not a bad app. It is that **building the app feels productive enough to replace studying**, and the exam arrives with a lot of TypeScript written and not much German learned. Hence the explicit position, agreed rather than assumed: building is not studying.

## Consequences

v0 has no backend, no database, no accounts, and no retrieval. Each learner supplies their own Gemini API key, held in browser storage, which is why there is no server holding a secret and why the app must never be deployed with a bundled key. Submissions are Markdown files on disk rather than rows in a database. None of this is technical debt to be repaid — v0 is expected to be discarded, and the thing that survives into v1 is the correction prompt, refined against five weeks of the author's real writing and real errors.

The six-hour cap is deliberately re-decided after one week of actual use rather than defended to the end. If the tool is being reached for unprompted, extending it is a rational bet; if it is being avoided, that is information worth more than the features it would have bought.

v1's own decisions were made during the same design session and are recorded here so they are not re-litigated: Google Cloud Run for the API, since Railway, Render and Fly.io no longer have free tiers that fit; Supabase free tier for Postgres and pgvector; the paid Gemini tier once other people's data is involved, because free-tier content trains Google's models; magic-link auth against a manual allowlist with no sharing between learners; the official Goethe sample papers as the shipped default corpus, with the copyrighted coursebook kept as a per-learner upload that is never redistributed.
