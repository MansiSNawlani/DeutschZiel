import { ERROR_CATEGORY_IDS, taxonomyForPrompt } from './taxonomy';
import type { JsonSchema } from './gemini';
import type { Task } from './types';
import { wortlisteForPrompt } from './wortliste';

/**
 * The correction prompt. Per docs/adr/0001-v0-v1-split.md this is the artifact
 * v0 exists to refine — it is the one thing expected to survive into v1, so it
 * is worth editing carefully and worth keeping the journal that shows whether
 * an edit made it better.
 */

export const FEEDBACK_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    criteria: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          criterion: { type: 'STRING', enum: ['Erfüllung', 'Kohärenz', 'Wortschatz', 'Strukturen'] },
          band: { type: 'INTEGER' },
          comment: { type: 'STRING' },
        },
        required: ['criterion', 'band', 'comment'],
      },
    },
    tiers: {
      type: 'OBJECT',
      properties: {
        correct: { type: 'STRING' },
        simpler: { type: 'STRING' },
        advanced: { type: 'STRING' },
      },
      required: ['correct', 'simpler', 'advanced'],
    },
    mistakes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          span: { type: 'STRING' },
          correction: { type: 'STRING' },
          category: { type: 'STRING', enum: ERROR_CATEGORY_IDS },
          explanation: { type: 'STRING' },
        },
        required: ['span', 'correction', 'category', 'explanation'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['criteria', 'tiers', 'mistakes', 'summary'],
};

/**
 * Task generation. Existing tasks are format exemplars, never templates to copy:
 * the point is fresh material at the same difficulty, because three tasks is two
 * days of practice and after that you are testing memory rather than German.
 *
 * Once the official Modellsatz is in Resources/, its tasks become the exemplars
 * here and are themselves held back for cold timed mocks.
 */
export const TASK_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    instruction: { type: 'STRING' },
    points: { type: 'ARRAY', items: { type: 'STRING' } },
    targetWords: { type: 'INTEGER' },
  },
  required: ['title', 'instruction', 'points', 'targetWords'],
};

export function buildTaskPrompt(exemplars: Task[], teil: 1 | 2 | 3): string {
  const sameTeil = exemplars.filter((t) => t.teil === teil);
  const shape = sameTeil[0];

  return [
    `Write ONE new Goethe-Zertifikat B1 Schreiben task for Aufgabe ${teil}.`,
    '',
    'Match the format and difficulty of these existing tasks exactly. Do not reuse their topics,',
    'situations or names — a learner who has done these must find the new one genuinely unfamiliar.',
    '',
    ...sameTeil.map((t) =>
      [
        `TITLE: ${t.title}`,
        `INSTRUCTION: ${t.instruction}`,
        `LEITPUNKTE: ${t.points.join(' | ')}`,
        `REGISTER: ${t.register} · ~${t.targetWords} words`,
      ].join('\n'),
    ),
    '',
    'Requirements:',
    `- Everything in German, at B1 level. Register must be ${shape?.register ?? 'informell'}.`,
    `- Exactly ${shape?.points.length ?? 3} Leitpunkte, each a distinct thing the learner must do.`,
    `- targetWords about ${shape?.targetWords ?? 80}.`,
    '- The situation must be everyday and concrete: appointments, travel, work, housing, health,',
    '  neighbours, courses, hobbies. Not abstract or academic.',
    '- The title follows the pattern "Aufgabe N — <two or three word description>".',
  ].join('\n');
}

export function buildSystemPrompt(opts: { useWortliste: boolean }): string {
  const parts = [
    `You are the Examiner for a learner preparing for the Goethe-Zertifikat B1, Modul Schreiben.
You assess a finished submission. You are never the learner's conversation partner and you never
role-play; you mark, explain, and rewrite.

LANGUAGE RULES — these are not stylistic preferences, follow them exactly:
- All German artifacts (the three rewrites, quoted spans, corrections) are in German.
- All explanations, comments and the summary are in ENGLISH. The learner is at B1 and reading a
  grammar rule in German costs comprehension effort that teaches them nothing.

CRITERIA. Score each of the four Goethe criteria with a band from 0 to 3, where 3 is the best.
- Erfüllung: were all the required Leitpunkte addressed, at appropriate length, in the right register?
- Kohärenz: is it ordered and connected, with appropriate connectors and a sensible opening and closing?
- Wortschatz: is the vocabulary adequate, varied and correctly used for B1?
- Strukturen: is the grammar correct and varied enough for B1?
A submission can be flawless German and still band 0 on Erfüllung by missing a Leitpunkt or using the
wrong register. Judge Erfüllung against the task, not against the quality of the German.

THE THREE REWRITES. All three rewrite the learner's WHOLE submission, not a single sentence.
- correct: the minimal repair. Keep their content, their structure and their voice; fix only what is
  wrong. If a sentence is already correct, leave it exactly as they wrote it.
- simpler: how a confident B1 speaker would say the same thing more naturally. Simpler than "correct"
  where "correct" is clumsy, not simpler than B1.
- advanced: deliberately above B1, showing where they are heading. Label-worthy as a stretch. Do not
  present it as what was expected.

MISTAKES. List every error as a separate entry.
- span: quote the learner's own words EXACTLY as they wrote them, so the interface can find the text.
  Never paraphrase a span, never quote your own corrected version there.
- category: choose exactly one id from this closed list and nothing else:
${taxonomyForPrompt()}
- explanation: one or two sentences of English saying why it is wrong and what the rule is. Say the
  rule, not just the fix.
Do not invent errors. If the German is correct, do not "improve" it into a mistake entry.`,
  ];

  if (opts.useWortliste) {
    parts.push(
      `VOCABULARY CEILING. The following is the official Goethe B1 Wortliste. The "correct" and
"simpler" rewrites must stay within it (compounds, names and obvious inflections of these words are
fine). The "advanced" rewrite is the one place you may go beyond it, and going beyond it is the point.

${wortlisteForPrompt()}`,
    );
  } else {
    parts.push(
      `VOCABULARY CEILING. Keep the "correct" and "simpler" rewrites within Goethe B1 vocabulary.
The "advanced" rewrite may deliberately exceed it.`,
    );
  }

  return parts.join('\n\n');
}

export function buildUserPrompt(opts: {
  task: Task;
  submission: string;
  wordCount: number;
  secondsSpent: number;
  /** Error category ids this learner has been repeating. See Q27 / CONTEXT.md. */
  recentPatterns?: { category: string; count: number }[];
}): string {
  const { task, submission, wordCount, secondsSpent, recentPatterns } = opts;

  const lines = [
    `TASK (Goethe B1 Schreiben, Aufgabe ${task.teil})`,
    task.instruction,
    '',
    'Leitpunkte the learner had to cover:',
    ...task.points.map((p, i) => `${i + 1}. ${p}`),
    '',
    `Register required: ${task.register}`,
    `Target length: about ${task.targetWords} words`,
    `Time allowed: ${task.minutes} minutes`,
    '',
    `THE LEARNER WROTE (${wordCount} words, in ${Math.round(secondsSpent / 60)} minutes):`,
    submission,
  ];

  if (recentPatterns?.length) {
    lines.push(
      '',
      'RECURRING MISTAKE PATTERNS for this learner, from previous attempts. If any of these appear',
      'again, say so explicitly in the summary — repetition is the thing they most need to see:',
      ...recentPatterns.map((p) => `- ${p.category} (${p.count} previous occurrences)`),
    );
  }

  return lines.join('\n');
}
