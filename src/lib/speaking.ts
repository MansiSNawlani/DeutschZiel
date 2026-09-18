/**
 * Sprechen Teil 2 — "Ein Thema präsentieren".
 *
 * Teil 2 is the monologue, which is why it comes first: it needs no Partner and
 * it is the most drillable part of the exam. Its five Folien are a fixed shape,
 * and coverage of them is most of the Erfüllung mark — a fluent presentation
 * that skips Folie 3 scores worse than a hesitant one that covers all five.
 *
 * Verify the Folien wording against your Modellsatz; this is the published
 * structure but the exact phrasing on the candidate sheet is what counts.
 */

import type { JsonSchema } from './gemini';
import { ERROR_CATEGORY_IDS, taxonomyForPrompt } from './taxonomy';
import type { ErrorCategoryId } from './taxonomy';

export const FOLIEN = [
  'Nennen Sie das Thema und sagen Sie, warum es Sie interessiert.',
  'Berichten Sie von Ihren eigenen Erfahrungen mit dem Thema.',
  'Berichten Sie, wie die Situation in Ihrem Heimatland ist.',
  'Nennen Sie Vor- und Nachteile und sagen Sie Ihre eigene Meinung.',
  'Beenden Sie Ihre Präsentation und bedanken Sie sich.',
] as const;

export type SpeakingTask = {
  id: string;
  topic: string;
  /** Seconds the presentation should run. The real Teil 2 is about three minutes. */
  targetSeconds: number;
  source: 'seed' | 'generated';
};

export const SEED_TOPICS: SpeakingTask[] = [
  { id: 'sp-einkaufen', topic: 'Einkaufen im Internet', targetSeconds: 180, source: 'seed' },
  { id: 'sp-stadt-land', topic: 'Leben in der Stadt oder auf dem Land', targetSeconds: 180, source: 'seed' },
  { id: 'sp-feste', topic: 'Feste und Feiern', targetSeconds: 180, source: 'seed' },
  { id: 'sp-sport', topic: 'Sport im Alltag', targetSeconds: 180, source: 'seed' },
  { id: 'sp-handy', topic: 'Das Handy im täglichen Leben', targetSeconds: 180, source: 'seed' },
  { id: 'sp-reisen', topic: 'Urlaub und Reisen', targetSeconds: 180, source: 'seed' },
];

export type FolieCoverage = {
  folie: number;
  covered: boolean;
  comment: string;
};

export type SpokenMistake = {
  said: string;
  correction: string;
  category: ErrorCategoryId;
  explanation: string;
};

export type SpeakingFeedback = {
  /**
   * What the model heard, verbatim, disfluencies and errors included.
   *
   * This is the single most important field on the screen. If it reads cleaner
   * than what actually came out of your mouth, the model repaired your German
   * on the way in and every grammar judgement below it is unreliable. It is the
   * calibration check, built into normal use rather than run as a separate test.
   */
  transcript: string;
  folien: FolieCoverage[];
  criteria: { criterion: string; band: number; comment: string }[];
  mistakes: SpokenMistake[];
  /** Specific things said, with a better way to say them. */
  betterPhrasings: { said: string; better: string; why: string }[];
  summary: string;
};

export const SPEAKING_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    folien: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          folie: { type: 'INTEGER' },
          covered: { type: 'BOOLEAN' },
          comment: { type: 'STRING' },
        },
        required: ['folie', 'covered', 'comment'],
      },
    },
    criteria: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          criterion: {
            type: 'STRING',
            enum: ['Erfüllung', 'Kohärenz', 'Wortschatz', 'Strukturen', 'Aussprache'],
          },
          band: { type: 'INTEGER' },
          comment: { type: 'STRING' },
        },
        required: ['criterion', 'band', 'comment'],
      },
    },
    mistakes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          said: { type: 'STRING' },
          correction: { type: 'STRING' },
          category: { type: 'STRING', enum: ERROR_CATEGORY_IDS },
          explanation: { type: 'STRING' },
        },
        required: ['said', 'correction', 'category', 'explanation'],
      },
    },
    betterPhrasings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          said: { type: 'STRING' },
          better: { type: 'STRING' },
          why: { type: 'STRING' },
        },
        required: ['said', 'better', 'why'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['transcript', 'folien', 'criteria', 'mistakes', 'betterPhrasings', 'summary'],
};

export function buildSpeakingSystemPrompt(): string {
  return `You are the Examiner for Goethe-Zertifikat B1, Modul Sprechen, Teil 2 — the candidate
presents a topic alone for about three minutes. You are given the actual audio recording. Listen to
it; do not assume it is fluent.

TRANSCRIBE FIRST, AND TRANSCRIBE HONESTLY. The transcript field must be what the candidate ACTUALLY
said, word for word in German — including grammatical errors, wrong articles, wrong verb forms,
false starts, repetitions and audible hesitation (äh, ähm). Do NOT correct, tidy, or complete their
German in the transcript. A tidy transcript of untidy speech is worse than useless here, because
every judgement below is checked against it. Mark unintelligible stretches as [unverständlich].

LANGUAGE RULES:
- The transcript, corrections and better phrasings are in German.
- All comments, explanations and the summary are in ENGLISH.

FOLIEN. Teil 2 has five required parts. Judge each one covered or not, and say briefly what was said
for it or what was missing. Coverage is most of the Erfüllung mark: a fluent presentation that skips
a Folie scores worse than a hesitant one that covers all five.
${FOLIEN.map((f, i) => `${i + 1}. ${f}`).join('\n')}

CRITERIA. Band 0-3, where 3 is best, for Erfüllung, Kohärenz, Wortschatz, Strukturen and Aussprache.
Judge Aussprache and fluency from the audio itself — pace, pausing, stress, intelligibility — not
from the transcript. Say plainly when something was hard to understand.

MISTAKES. Every error as a separate entry, with the candidate's own words in "said", quoted exactly
as they appear in your transcript. Classify each into exactly one id from this closed list:
${taxonomyForPrompt()}

BETTER PHRASINGS. Up to five things they actually said, with a more natural B1 way to say them.
Not a rewrite of the whole presentation — specific, quotable swaps they can reuse next time.

Do not invent errors. If something was correct, leave it alone.`;
}

export function buildSpeakingUserPrompt(task: SpeakingTask, seconds: number): string {
  return [
    `TOPIC: ${task.topic}`,
    '',
    'Required Folien:',
    ...FOLIEN.map((f, i) => `${i + 1}. ${f}`),
    '',
    `The recording is ${seconds} seconds long; the target is about ${task.targetSeconds} seconds.`,
    seconds < task.targetSeconds * 0.6
      ? 'This is well short of the expected length — say so, and say what was missing.'
      : '',
    '',
    'The audio follows. Listen to it and assess the presentation.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTopicPrompt(existing: SpeakingTask[]): string {
  return [
    'Write ONE new Goethe-Zertifikat B1 Sprechen Teil 2 presentation topic in German.',
    '',
    'It must be an everyday theme a B1 candidate can speak about for three minutes from personal',
    'experience, and it must work with all five standard Folien — especially "the situation in your',
    'home country" and "advantages and disadvantages". Two to five words, no question mark.',
    '',
    `Do not repeat any of these: ${existing.map((t) => t.topic).join('; ')}`,
  ].join('\n');
}

export const TOPIC_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: { topic: { type: 'STRING' } },
  required: ['topic'],
};
