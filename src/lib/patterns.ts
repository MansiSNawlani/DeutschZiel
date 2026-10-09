/**
 * Mistake patterns computed from the Attempt files themselves.
 *
 * mistakes.md only keeps running totals, with no dates, so it cannot say
 * whether a mistake is still happening and drifts when an Attempt file is
 * deleted by hand. Every Attempt file already carries its date and its Error
 * categories in the frontmatter, and each Mistake instance in its Mistakes
 * section, so the pattern view reads those instead.
 */

export type MistakeExample = { category: string; wrote: string; correction: string };

export type AttemptRecord = {
  date: string;
  categories: string[];
  skill: 'schreiben' | 'sprechen';
  /** Parsed from the Mistakes section; may be shorter than categories if a line is malformed. */
  examples: MistakeExample[];
};

export type PatternRow = {
  /** An ErrorCategoryId, or an unknown id kept verbatim so taxonomy drift shows. */
  category: string;
  /** Distinct Attempts containing it. */
  attempts: number;
  /** Total Mistake instances across all Attempts. */
  instances: number;
  /** ISO date of the most recent Attempt containing it. */
  lastSeen: string;
  /** Appears in two or more distinct Attempts. */
  recurring: boolean;
  /** Appears in one of the last RECENT_ATTEMPTS Attempts. A recurring row without it is easing off. */
  inRecent: boolean;
  /** From the most recent Attempt containing it, when its Mistakes line parsed. */
  example?: MistakeExample;
};

/**
 * One Attempt is too few to call a mistake gone: the latest may simply be the
 * other skill. Two still reacts within a few days of practice.
 */
export const RECENT_ATTEMPTS = 2;

/** Both writers in journal.ts emit: - `category` **what was written** → **correction** */
const MISTAKE_LINE = /^- `([a-z-]+)` \*\*(.+?)\*\* → \*\*(.+?)\*\*\s*$/;

/** Reads one Attempt file. Null when its frontmatter is missing or incomplete. */
export function parseAttemptRecord(markdown: string): AttemptRecord | null {
  const lines = markdown.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;

  const fields = new Map<string, string>();
  let end = 1;
  for (; end < lines.length; end++) {
    if (lines[end].trim() === '---') break;
    const match = /^([a-z]+):\s*(.*)$/.exec(lines[end]);
    if (match) fields.set(match[1], match[2].trim());
  }

  const date = fields.get('date');
  const categories = fields.get('categories');
  if (!date || Number.isNaN(Date.parse(date)) || categories === undefined) return null;

  const examples: MistakeExample[] = [];
  let inMistakes = false;
  for (const line of lines.slice(end + 1)) {
    if (line.startsWith('## ')) inMistakes = line.trim() === '## Mistakes';
    else if (inMistakes) {
      const match = MISTAKE_LINE.exec(line);
      if (match) examples.push({ category: match[1], wrote: match[2], correction: match[3] });
    }
  }

  return {
    date,
    categories:
      categories === 'none'
        ? []
        : categories
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
    skill: fields.get('skill') === 'sprechen' ? 'sprechen' : 'schreiben',
    examples,
  };
}

/** One row per Error category seen, recurring ones first. */
export function summarisePatterns(records: AttemptRecord[]): PatternRow[] {
  const ordered = [...records].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const recentFrom = ordered.length - RECENT_ATTEMPTS;
  const rows = new Map<string, PatternRow>();

  ordered.forEach((record, index) => {
    for (const category of new Set(record.categories)) {
      const row = rows.get(category) ?? {
        category,
        attempts: 0,
        instances: 0,
        lastSeen: record.date,
        recurring: false,
        inRecent: false,
      };
      row.attempts++;
      row.instances += record.categories.filter((c) => c === category).length;
      row.lastSeen = record.date;
      row.inRecent = index >= recentFrom;
      row.example = record.examples.find((e) => e.category === category) ?? row.example;
      rows.set(category, row);
    }
  });

  return [...rows.values()]
    .map((row) => ({ ...row, recurring: row.attempts >= 2 }))
    .sort(
      (a, b) =>
        Number(b.recurring) - Number(a.recurring) ||
        b.attempts - a.attempts ||
        b.instances - a.instances ||
        Date.parse(b.lastSeen) - Date.parse(a.lastSeen),
    );
}
