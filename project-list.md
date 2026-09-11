# DeutschZiel

**Lernen. Üben. Bestehen.**

*A personal German exam-prep tutor, built as a learning project in React Native (Expo) + LLM/RAG, for a small group of friends preparing for Goethe/telc B1–B2.*

---

## Overview

DeutschZiel is a German exam-preparation app for learners preparing for the Goethe or telc B1/B2 exam. It acts like a personal tutor: it uses the learner's own textbook content, exam materials, sample papers, and audio as a knowledge base, and provides structured training across Lesen, Hören, Schreiben, and Sprechen.

The goal isn't just to teach German — it's to help the learner understand what they need to know, practice it repeatedly, get useful corrections, and gradually become exam-ready.

This build has two purposes that shape almost every decision below: it's a real tool for you and a small group of friends to prepare for your exams, and it's a hands-on project for learning React Native/Expo and the LLM + RAG stack (chunking, embeddings, vector search, retrieval-grounded generation, evaluation pipelines). Scope choices throughout favor "buildable and genuinely useful for ~5–15 people" over "production SaaS."

## Scope & Distribution

This is not going to be a public product for now, and the doc no longer treats it as one — no licensing strategy, no monetization model, no GDPR program. That said, a few practical defaults are worth setting now so you don't have to rearchitect later if it ever does grow:

- **Audience:** you and a closed group of friends, invited manually. No public sign-up.
- **Distribution:** Expo + EAS Build for iOS and Android, with iOS beta testing through **TestFlight** and Android through Google Play's internal testing track (or just sideloaded builds / Expo Go during early dev). The same Expo codebase exports to web (`expo export --platform web` or an Expo Router web build) and can be deployed to something like Vercel or Netlify for the website version — one codebase, three targets.
- **Data handling, kept simple but not careless:** each user's uploaded material and RAG index stays scoped to that user (per-user namespace, not a shared pool) — mainly because it keeps retrieval clean, but it also means you're not building a shared corpus out of other people's textbooks, which is the one licensing-adjacent habit worth keeping even at small scale. Recordings and writing samples used for feedback are fine to store for the person's own progress tracking; there's no need for a data-retention policy yet, just don't lose sight of the fact that it's still other people's data if friends start using it.
- **Revisit later:** if this ever moves beyond friends, the monetization/licensing/GDPR questions from the earlier draft come back into play. Worth a one-line note-to-self, not a section, for now.

## Core Product Idea

DeutschZiel should not be a generic German-learning app with an exam mode bolted on. Exam preparation is the central purpose.

The core loop:

**Learn → Practice → Get corrected → Understand mistakes → Practice again → Become exam-ready**

The differentiator is the combination of:

- The learner's own study material
- Their current German level (per skill, not a single number)
- Their target exam and level
- Adaptive practice
- Detailed, level-appropriate feedback
- All four exam skills
- Progress and exam-readiness tracking

The learner shouldn't have to bounce between a textbook, YouTube, vocab apps, grammar sites, speaking partners, and exam-question sites. DeutschZiel brings these into one environment.

## User Flow

1. User creates an account and selects their target exam and level. For the first build, model **Goethe B1** in full depth as the reference implementation; represent the exam structure as data (task types, timing, scoring, instructions) so that telc B1, Goethe B2, and telc B2 are additional config entries later rather than new code paths. Friends targeting a different exam can still select it in the UI, but it'll be lower-fidelity until its config is filled in.
2. If the user doesn't upload anything, the app already has a default textbook pre-ingested and ready to go — no material upload is required to start using the tutor. The user can add their own textbooks and material at any time, not just at onboarding; uploads extend the default content rather than replace it, unless the user explicitly turns the default off.
3. DeutschZiel processes uploaded material into a searchable knowledge base (chunking → embeddings → vector store), scoped per user and merged with the default collection at retrieval time.
4. The user asks the tutor questions, requests explanations, or starts a training session for a specific skill.
5. The user picks an area to practice: Lesen, Hören, Schreiben, or Sprechen.
6. DeutschZiel provides questions based on the user's current level, target level, and exam format — sourced from uploaded material, adapted from it, or newly generated.
7. After each question/section, the user gets immediate feedback:
   - What was correct
   - What was incorrect
   - Why it was incorrect
   - The correct version
   - A simpler/natural way to say the same thing
   - A more advanced way to express it, when useful
8. Difficulty adapts to the learner. An A2-level learner's mistake shouldn't be corrected with a C1/C2 sentence — explain in language they can follow, and introduce more advanced structures gradually as they improve.
9. The app tracks progress and identifies weak areas so future sessions focus where it matters.
10. As the exam approaches, DeutschZiel shifts toward realistic exam simulations and a readiness indicator.

## AI Tutor

The core of DeutschZiel is an AI tutor that behaves like a personal teacher, not a chatbot. It should understand the learner's current ability, target level, and history, and adapt accordingly.

Example: if a learner writes *"Ich habe gestern gegangen ins Kino,"* DeutschZiel should not respond with something like *"Gestern Abend begab ich mich ins Kino."* It should explain the actual mistake and give an appropriate correction:

> Correct: *Ich bin gestern ins Kino gegangen.*

Then explain why "bin gegangen" is needed, and optionally show a more natural or advanced alternative. This principle — correct at the learner's level while gradually stretching them toward the target — applies throughout the app.

## Skill Sequencing (build order)

The four skills are not equally hard to build, so the practice phase is split by technical complexity rather than done all at once:

1. **Lesen + Schreiben first.** Both are text-in, text-out, and today's LLMs handle grammar/vocab/structure correction very well. This pair alone — especially writing correction with the correct/simpler/advanced tiering — is a genuinely useful standalone product and the best place to prove out the RAG + evaluation pipeline before adding audio.
2. **Hören next.** Needs sourced or generated audio and a place to store/stream it, but no speech *input* to evaluate — meaningfully simpler than Sprechen.
3. **Sprechen last.** Needs recording, transcription, and (eventually) pronunciation evaluation — the hardest part of the whole app. Start with transcription-based feedback only (grammar, vocabulary, fluency-from-transcript, task completion); real pronunciation scoring is a later add-on, not a v1 requirement.

### Reading — Lesen

- Explain vocabulary and grammar found in a text
- Ask comprehension questions
- Generate similar questions
- Create exam-style reading exercises
- Explain why an answer is correct or incorrect
- Identify useful vocabulary and expressions
- Adjust difficulty between A2, B1, and B2
- Track recurring reading mistakes

### Listening — Hören

Users upload sample audio and questions so DeutschZiel learns the structure of listening exercises. The app provides audio, questions, difficulty levels, exam-style tasks, immediate correction, explanations, and vocabulary drawn from the audio, plus similar generated exercises. A later iteration can use LLM-generated scripts + text-to-speech for original listening content.

### Writing — Schreiben

Probably the highest-value skill to get right first. The user writes directly in the app and gets feedback on grammar, word choice, sentence structure, vocabulary, spelling, register (formal/informal), task completion, coherence, and exam-specific requirements — distinguishing between correction tiers:

**Your sentence:**
Ich möchte einen Termin machen, weil ich brauche einen Arzt.

**Correct:**
Ich möchte einen Termin vereinbaren, weil ich einen Arzt brauche.

**Simpler:**
Ich möchte einen Termin beim Arzt machen.

**More advanced/natural:**
Ich möchte gerne einen Termin vereinbaren, da ich einen Arzttermin benötige.

### Speaking — Sprechen

Structured speaking practice mirroring the real exam: see/hear a task, prepare, record, submit, get feedback, repeat, and compare first vs. later attempts. First version: transcription-based feedback on grammar, vocabulary, fluency, structure, and task completion. Pronunciation analysis is a real research problem on its own — treat it as a later phase, not a v1 gap to apologize for.

## Exam Preparation

DeutschZiel should explicitly model the exam formats it supports rather than inferring structure from uploaded documents. Build **Goethe B1** as a fully modeled reference (sections, task types, timing, scoring, instructions as structured data), then add telc B1 / Goethe B2 / telc B2 as additional config once the pattern is proven.

The system should support skill-specific practice, exam-style questions, timed exercises, section-level tests, full mock exams, mistake review, and a readiness indicator.

## Content Generation

DeutschZiel generates new practice material rather than reusing the same questions. After studying a textbook chapter on, say, appointments and health, it might generate a new B1 reading text, comprehension questions, a listening exercise, a writing task, and a speaking task — all respecting the selected exam, level, and skill.

Existing sample questions are used as examples of format and difficulty, not copied outright. Generated content goes through a validation pass before being shown as practice material:

**Generate → Validate level → Validate grammar → Validate answers → Validate exam format → Store**

At this scale, automated (LLM-based) validation is enough — no need for a human review layer yet, though it's worth keeping the pipeline structured so one could be added later if the group grows or a batch of generated content turns out low-quality.

## Content Sources

- **Default seed textbook:** one textbook, pre-ingested at system scope, available to every user out of the box so nobody has to upload anything before they can start practicing. Stored the same way as user material, just tagged as default/shared rather than owned by a specific user.
- **User-provided material:** textbook PDFs, personal notes, sample exercises, audio files — kept per-user, not pooled with other users' uploads. Uploadable at any time from "My Material," not just at signup. By default this *extends* the default seed textbook (retrieval draws from both); a per-user setting lets someone turn the default off and rely only on their own material.
- **Publicly available exam information:** sample papers, exam instructions, and other publicly posted material from Goethe-Institut/telc, used as *format and difficulty reference*, not redistributed verbatim.
- **Original AI-generated material:** new reading texts, listening scripts, writing tasks, speaking tasks, and similar-questions — this is the actual content engine long-term, since it scales without depending on how much sample material any one person uploaded.

Scraping questions from arbitrary websites isn't part of the design — not because of a compliance program here, but because it's unreliable and inconsistent in quality, which defeats the point.

## Adaptive Difficulty

The system maintains a separate ability estimate per skill rather than one blended level:

- Reading: B1
- Listening: A2+
- Writing: A2/B1
- Speaking: A2
- Grammar: B1
- Vocabulary: B1

If a learner targeting B1 consistently performs at A2 in one area, DeutschZiel gives appropriately intermediate practice there rather than forcing difficult material — while still nudging difficulty upward over time so the learner keeps being challenged toward the target.

Three distinct notions to keep separate in the data model:

- **Current level** — what the learner can comfortably do now.
- **Target level** — what they need for the exam.
- **Challenge level** — what they should practice next to close the gap.

## Progress & Readiness

Track questions attempted, accuracy, recurring mistakes, vocabulary learned, and performance by skill, topic, and exam section. Turn this into a readiness estimate, e.g.:

> Goethe B1 Readiness: 74%
> Lesen: 82% · Hören: 68% · Schreiben: 71% · Sprechen: 75%
> Focus next: Hören + Schreiben

Treat this as an internal progress indicator, not a validated pass/fail predictor — there's no real exam-outcome data to calibrate against, and there's no need to pretend otherwise even in a friends-only build.

## UI

Since this ships as one Expo codebase across iOS, Android, and web, the UI needs to hold up in all three without diverging into separate designs. A few practical implications:

- Favor layouts that reflow cleanly between a phone screen and a browser window (avoid fixed-width assumptions; lean on Flexbox-based RN layout, which maps reasonably well to web).
- Audio recording (Sprechen) behaves differently on native (expo-av / expo-audio) vs. web (MediaRecorder API) — plan for a thin platform-specific recording layer behind a shared interface early, rather than retrofitting it.
- Keep the interaction loop consistent everywhere: **Question → Answer → Correction → Explanation → Next.**

Main areas: Dashboard, My Material, Learn, Practice, Mock Exam, Mistakes, Progress. The dashboard shows the target and readiness at a glance (e.g. "Goethe B1 · Exam readiness: 72%") and highlights what to practice next. For writing and speaking, the feedback view should make the diff between the user's answer and the improved version easy to scan at a glance.

## Tech Stack

**Frontend:** Expo (React Native + Expo Router), targeting iOS, Android, and web from one codebase. EAS Build for native binaries; TestFlight for iOS beta distribution to friends, Google Play internal testing (or direct APK) for Android; Expo's web export deployed to Vercel/Netlify for the website.

**Backend:** a Node (Express/Fastify) or Python (FastAPI) API — Python has the stronger ecosystem for PDF processing, audio handling, and embedding/RAG tooling if this is also meant as an LLM/RAG learning project; Node keeps one language across the whole stack if that's preferred. Either is fine at this scale — pick based on which stack you want more practice in.

**Database:** PostgreSQL with the `pgvector` extension, so structured data (users, sessions, questions, corrections, progress) and vector embeddings live in one system rather than standing up a separate vector DB. Good enough at friends-group scale; swap for a dedicated vector store later only if retrieval performance actually demands it.

**LLM:** an API-based model (Claude or similar) for tutoring, correction, and question generation; a separate cheaper/faster call tier for validation steps if cost becomes noticeable.

**Audio:** Whisper (API or self-hosted) for transcription; a TTS API for generated listening material once that phase is reached.

**Background jobs:** ingestion, transcription, chunking, embedding, and content generation are all long-running and should run as background jobs, not inline with the request — a simple job queue (e.g. BullMQ on Node, or Celery/RQ on Python) is enough; no need for a heavyweight durable-workflow engine at this scale.

**Hosting:** something cheap and simple (Railway, Render, Fly.io) is plenty for a friends-scale backend + Postgres instance.

## Retrieval / AI Knowledge Base

Uploaded and processed material is stored in a searchable knowledge base. When a user asks "Why is this answer wrong?" or "Explain this grammar topic from my textbook," the relevant content is retrieved and given to the tutor as context, so answers are grounded in the learner's own material rather than the model's general knowledge alone.

**PDF / Audio / Exam Material → Processing → Chunking → Embeddings → Vector Database (pgvector) → Retrieval → AI Tutor**

## Content Ingestion

Handles German textbook PDFs, user-provided sample papers, user-provided audio, and publicly available exam information.

PDFs are processed while preserving useful structure — chapters, sections, headings, exercises, page references — and split into meaningful chunks (not arbitrary text windows) before embedding. Audio is transcribed where possible, with the transcript tied back to its source audio and exercise.

**Default vs. personal material.** Every document is scoped either to the system (the default seed textbook, available to all users automatically) or to a specific user (their own uploads). At retrieval time, the tutor searches both the default collection and the requesting user's own collection and merges results — so a user gets the benefit of the seed book immediately, and anything they upload afterward simply adds more retrievable context on top, at any point in time. A per-user setting can disable the default collection entirely for someone who wants retrieval limited to their own material only.

**Page limits.** pgvector handles a large personal library without issue — the real constraint is background-job processing time, not storage. As a soft cap: **~400–500 pages** per upload for normal text-based PDFs (comfortably above any single coursebook, even combined with a workbook), and **~150–200 pages** as the comfortable ceiling for scanned/image-based PDFs that need OCR, since OCR runs much slower per page than native text extraction. Large scanned documents should be processed in resumable batches (e.g. N pages per job run) rather than one long-running job, so a big book doesn't fail outright if it exceeds a single worker execution window.

## Backend & Architecture

Core components: authentication, user profiles and progress, PDF/document processing, audio transcription, chunking, embedding generation, vector search, LLM-based tutoring, question generation, answer evaluation, writing correction, speaking evaluation, exam simulation, progress tracking.

Long-running ingestion/processing work (PDF ingestion, transcription, chunking, embedding, content generation) runs as background jobs so it doesn't block the request and can be retried on failure without restarting the whole pipeline.

## Database

Stores: users, target exam and level, uploaded materials, documents and metadata, chapters/sections, content chunks, vector embeddings, questions, answers, corrections, practice sessions, exam attempts, speaking/writing evaluations, user progress, mistake history, learning history.

`documents` should carry a nullable `owner_user_id` (null = default seed textbook, set = a specific user's upload) plus a `use_default_material` flag on the user/settings table, so retrieval can cheaply decide which collections to merge per request.

pgvector handles semantic retrieval; the same Postgres instance holds the structured application data and learning history — no need for a separate system at this scale.

## Realistic Scope & Technical Limitations

**Realistic for v1:**

- User auth
- Goethe B1 exam config (as the reference implementation)
- PDF textbook upload + text extraction + structured chunking
- Embeddings + vector search (pgvector)
- RAG-based textbook tutor
- Reading exercises
- Writing exercises with tiered correction
- Answer correction, level-appropriate explanations
- Mistake tracking, basic progress tracking
- Basic exam-style questions
- Expo app running on iOS (TestFlight), Android, and web from one codebase

**Realistic as later phases:**

- Listening exercises (sourced audio first, generated audio later)
- Audio transcription for Sprechen
- AI-generated listening exercises with TTS
- Voice-based speaking practice + automated evaluation
- Adaptive difficulty, personalized study plans
- Full mock exams, exam-readiness scoring
- Sophisticated pronunciation analysis
- B2 support, telc format, additional exam configs

**Not to assume works perfectly:** generated content needs the validation pass before it's shown as real practice material; AI corrections should be explained rather than presented as absolute truth; a readiness percentage is a progress estimate, not a guarantee.

## Development Strategy

### Phase 1 — Tutor + Textbook
Upload a B1 textbook and interact with it through an AI tutor.
Build: auth, PDF upload, document processing, chunking, Postgres + pgvector, RAG, basic tutor interface, and the Expo shell running on iOS/Android/web.

### Phase 2a — Practice: Reading + Writing
Add Lesen and Schreiben, question generation, answer evaluation, tiered corrections, level-aware explanations. This is the first phase that's a genuinely complete, usable product on its own.

### Phase 2b — Practice: Listening + Speaking
Add Hören (sourced/generated audio, questions, correction) and Sprechen (recording, transcription-based feedback). Kept separate from 2a because of the audio infrastructure and platform-specific recording work.

### Phase 3 — Exam Training
Add exam task types, timed exercises, section tests, mock exams, exam scoring, mistake history, and a progress dashboard — built against the Goethe B1 config from Phase 1.

### Phase 4 — Adaptive Tutor
Add skill-level estimation, weak-topic detection, adaptive difficulty, personalized training, "practice my mistakes," a readiness score, improved speaking evaluation, and generated listening exercises.

### Phase 5 — Expansion
Once the Goethe B1 experience is solid: add telc B1, Goethe B2, telc B2 as additional exam configs (this is where the earlier "model exam structure as data" decision pays off), more learning materials, and richer learner modeling.

## Core Principle

DeutschZiel isn't trying to replace every German-learning resource. It's the place where you bring your own study material and turn it into a structured, adaptive, exam-focused training system — for now, for you and your friends, and as a genuinely solid way to learn React Native/Expo and the LLM + RAG stack end to end.

**Learn what you need. Practice what you're weak at. Understand every mistake. Train at the right difficulty. Become ready to pass.**