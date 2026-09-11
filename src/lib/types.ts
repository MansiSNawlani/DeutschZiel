import type { ErrorCategoryId } from './taxonomy';

/** See CONTEXT.md — a Task is the thing to do, not the thing produced. */
export type Task = {
  id: string;
  teil: 1 | 2 | 3;
  title: string;
  /** The instruction the learner reads, in German, as the exam presents it. */
  instruction: string;
  /** The Leitpunkte the learner must cover. Erfüllung is scored against these. */
  points: string[];
  register: 'informell' | 'formell';
  targetWords: number;
  minutes: number;
  /** Where this Task came from — an official paper, or generated from one. */
  source: 'seed' | 'generated' | 'modellsatz';
};

/**
 * One of the named Goethe criteria. Bands run 0-3 mirroring the official
 * descriptor levels, but the exact band boundaries must be checked against the
 * Bewertungskriterien in the Modellsatz — this is an approximation until then.
 */
export type CriterionScore = {
  criterion: 'Erfüllung' | 'Kohärenz' | 'Wortschatz' | 'Strukturen';
  band: number;
  comment: string;
};

export type MistakeInstance = {
  /** The learner's own words, quoted exactly, so the UI can locate it. */
  span: string;
  correction: string;
  category: ErrorCategoryId;
  /** Why it is wrong. In English — see CONTEXT.md on feedback language. */
  explanation: string;
};

/** The three parallel rewrites. See Correction tier in CONTEXT.md. */
export type CorrectionTiers = {
  correct: string;
  simpler: string;
  advanced: string;
};

export type Feedback = {
  criteria: CriterionScore[];
  tiers: CorrectionTiers;
  mistakes: MistakeInstance[];
  /** Two sentences, English, what to do differently next time. */
  summary: string;
};

/** A Task, its Submission and its Feedback taken together. */
export type Attempt = {
  id: string;
  task: Task;
  submission: string;
  feedback: Feedback;
  wordCount: number;
  /** Seconds spent writing, against Task.minutes. Advisory. */
  secondsSpent: number;
  createdAt: string;
};
