/**
 * Attempt files read back for the history screens.
 *
 * The journal holds two formats. Entries written before the A-E bands carry
 * `- **Erfüllung** 2/3 — comment` lines on the old 0-3 scale, which cannot be
 * converted to a letter honestly, so they are kept as they are. Entries after
 * it carry `- **Erfüllung** B (7,5/10) - comment` and a Total line. The Total
 * line is ignored: totals are recomputed from the letters so the Erfüllung E
 * rule is applied the same way it is on the live Feedback.
 */

import {
  type Band,
  SCHREIBEN_CRITERIA,
  SPRECHEN_CRITERIA,
  type SchreibenCriterion,
  type SprechenCriterion,
  type Total,
  schreibenTotal,
  sprechenTeil2Total,
} from './bewertung';
import { MISTAKE_LINE, type Skill, parseAttemptRecord } from './patterns';

export type { Skill };

export type CriterionLine =
  | { criterion: string; scale: 'band'; band: Band; comment: string }
  /** Old 0-3 scale, n of 3. */
  | { criterion: string; scale: 'legacy'; score: number; comment: string }
  /** Anything else starting `- **`, shown verbatim. */
  | { criterion: string; scale: 'unknown'; raw: string };

export type JournalAttempt = {
  /** The filename, also the route param. */
  file: string;
  skill: Skill;
  /** Null when the frontmatter `teil` is missing or not 1-3; no total is shown then. */
  teil: 1 | 2 | 3 | null;
  date: string;
  /** The first `# ` heading. */
  title: string;
  /** Kept as written: words, minutes, seconds, topic, task. */
  frontmatter: Record<string, string>;
  /** The Task instruction and Leitpunkte between the title and the first section. */
  intro: string;
  criteria: CriterionLine[];
  /** How many of `sections` come before the Criteria section, so it renders in file order. */
  criteriaAt: number;
  categories: string[];
  /** Every `## ` section except Criteria, in file order. */
  sections: { heading: string; body: string }[];
};

/** Both writers in journal.ts: `<stamp>-<task.id>.md` or `<stamp>-sprechen-<task.id>.md`. */
const FILE_NAME = /^\d{4}-\d{2}-\d{2}-\d{4}(?:\d{2})?-(sprechen-)?(.+)\.md$/;

export type TaskKey = { skill: Skill; taskId: string };

/** Which Task a file belongs to, from its name. Null when the name does not follow the pattern. */
export function taskKey(name: string): TaskKey | null {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  return { skill: match[1] ? 'sprechen' : 'schreiben', taskId: match[2] };
}

export function sameTask(a: TaskKey | null, b: TaskKey | null): boolean {
  return !!a && !!b && a.skill === b.skill && a.taskId === b.taskId;
}

const BAND_LINE = /^- \*\*(.+?)\*\* ([A-E]) \([\d,]+\/\d+\) - (.*)$/;
const LEGACY_LINE = /^- \*\*(.+?)\*\* ([0-3])\/3 — (.*)$/;

function parseCriterion(line: string): CriterionLine | null {
  if (!line.startsWith('- **') || line.startsWith('- **Total**')) return null;
  const band = BAND_LINE.exec(line);
  if (band)
    return {
      criterion: band[1],
      scale: 'band',
      band: band[2] as Band,
      comment: band[3],
    };
  const legacy = LEGACY_LINE.exec(line);
  if (legacy) {
    return {
      criterion: legacy[1],
      scale: 'legacy',
      score: Number(legacy[2]),
      comment: legacy[3],
    };
  }
  return { criterion: '', scale: 'unknown', raw: line };
}

/** Reads one Attempt file. Null under the same rule as parseAttemptRecord. */
export function parseJournalAttempt(file: string, markdown: string): JournalAttempt | null {
  const record = parseAttemptRecord(markdown);
  if (!record) return null;

  const lines = markdown.replace(/^﻿/, '').split(/\r?\n/);
  const frontmatter: Record<string, string> = {};
  let end = 1;
  for (; end < lines.length; end++) {
    if (lines[end].trim() === '---') break;
    const match = /^([a-z]+):\s*(.*)$/.exec(lines[end]);
    if (match) frontmatter[match[1]] = match[2].trim();
  }

  let title = '';
  const intro: string[] = [];
  const criteria: CriterionLine[] = [];
  const sections: { heading: string; body: string[] }[] = [];
  let criteriaAt = -1;
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines.slice(end + 1)) {
    if (!title && !current && line.startsWith('# ')) {
      title = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), body: [] };
      if (current.heading === 'Criteria') criteriaAt = sections.length;
      else sections.push(current);
    } else if (current?.heading === 'Criteria') {
      const criterion = parseCriterion(line);
      if (criterion) criteria.push(criterion);
    } else if (current) {
      current.body.push(line);
    } else {
      intro.push(line);
    }
  }

  const teil = Number(frontmatter.teil);
  return {
    file,
    skill: record.skill,
    teil: teil === 1 || teil === 2 || teil === 3 ? teil : null,
    date: record.date,
    title: title || file,
    frontmatter,
    intro: intro.join('\n').trim(),
    criteria,
    criteriaAt: criteriaAt < 0 ? sections.length : criteriaAt,
    categories: record.categories,
    sections: sections.map((s) => ({
      heading: s.heading,
      body: s.body.join('\n').trim(),
    })),
  };
}

const isSchreibenCriterion = (c: string): c is SchreibenCriterion =>
  (SCHREIBEN_CRITERIA as readonly string[]).includes(c);
const isSprechenCriterion = (c: string): c is SprechenCriterion =>
  (SPRECHEN_CRITERIA as readonly string[]).includes(c);

/** Whether bewertung.ts can score this criterion for the Attempt's skill. */
export function knownCriterion(attempt: JournalAttempt, criterion: string): boolean {
  return attempt.skill === 'sprechen'
    ? isSprechenCriterion(criterion)
    : isSchreibenCriterion(criterion);
}

/**
 * The Aufgabe or Teil 2 total, or null when any criterion that counts towards
 * it is missing or not on the A-E scale. A partial total would understate it.
 */
export function entryTotal(attempt: JournalAttempt): Total | null {
  const scored = attempt.criteria.flatMap((c) =>
    c.scale === 'band' ? [{ criterion: c.criterion, band: c.band }] : [],
  );
  if (!SCHREIBEN_CRITERIA.every((c) => scored.some((s) => s.criterion === c))) return null;
  if (attempt.skill === 'sprechen') return sprechenTeil2Total(scored);
  return attempt.teil ? schreibenTotal(attempt.teil, scored) : null;
}

/** "Aufgabe 1" or "Sprechen Teil 2", as the exam names them. */
export function entryLabel(attempt: JournalAttempt): string {
  if (attempt.skill === 'sprechen') return 'Sprechen Teil 2';
  return attempt.teil ? `Schreiben Aufgabe ${attempt.teil}` : 'Schreiben';
}

/** Just the day, for labels next to a Versuch number: 04.10. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type SectionItem =
  | {
      kind: 'mistake';
      category: string;
      wrote: string;
      correction: string;
      explanation: string;
    }
  | { kind: 'folie'; folie: number; covered: boolean; comment: string }
  | { kind: 'phrasing'; said: string; better: string; why: string }
  | { kind: 'text'; text: string };

const FOLIE_LINE = /^- (✓|✗) \*\*Folie (\d)\*\* — (.*)$/;
const PHRASING_LINE = /^- \*\*(.+?)\*\* → \*\*(.+?)\*\*\s*$/;

/**
 * The list sections, one item per entry, with the indented line under an entry
 * as its explanation. A line that does not match is kept as text, never dropped.
 * Any other section is one text item.
 */
export function sectionItems(heading: string, body: string): SectionItem[] {
  if (heading !== 'Mistakes' && heading !== 'Folien' && heading !== 'Better phrasings') {
    return body ? [{ kind: 'text', text: body }] : [];
  }
  const items: SectionItem[] = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const last = items[items.length - 1];
    if (line.startsWith('  ') && last && (last.kind === 'mistake' || last.kind === 'phrasing')) {
      if (last.kind === 'mistake')
        last.explanation = [last.explanation, line.trim()].filter(Boolean).join(' ');
      else last.why = [last.why, line.trim()].filter(Boolean).join(' ');
      continue;
    }
    const mistake = heading === 'Mistakes' ? MISTAKE_LINE.exec(line) : null;
    const folie = heading === 'Folien' ? FOLIE_LINE.exec(line) : null;
    const phrasing = heading === 'Better phrasings' ? PHRASING_LINE.exec(line) : null;
    if (mistake) {
      items.push({
        kind: 'mistake',
        category: mistake[1],
        wrote: mistake[2],
        correction: mistake[3],
        explanation: '',
      });
    } else if (folie) {
      items.push({
        kind: 'folie',
        covered: folie[1] === '✓',
        folie: Number(folie[2]),
        comment: folie[3],
      });
    } else if (phrasing) {
      items.push({
        kind: 'phrasing',
        said: phrasing[1],
        better: phrasing[2],
        why: '',
      });
    } else {
      items.push({ kind: 'text', text: line.trim() });
    }
  }
  return items;
}

/** Error categories split by whether they went away between two Attempts. */
export function compareCategories(first: string[], later: string[]) {
  const a = new Set(first);
  const b = new Set(later);
  return {
    gone: [...a].filter((c) => !b.has(c)),
    still: [...a].filter((c) => b.has(c)),
    added: [...b].filter((c) => !a.has(c)),
  };
}

const AGAINST = /^(\d+) \((?:target|allowed) (\d+)\)$/;

/** Words, minutes or seconds against the Task's target, from the frontmatter. */
export function entryEffort(attempt: JournalAttempt): string[] {
  const units: [string, string][] = [
    ['words', 'Wörter'],
    ['minutes', 'Min.'],
    ['seconds', 's'],
  ];
  return units.flatMap(([field, unit]) => {
    const value = attempt.frontmatter[field];
    if (!value) return [];
    const match = AGAINST.exec(value);
    return [match ? `${match[1]} / ${match[2]} ${unit}` : `${value} ${unit}`];
  });
}

/** Written before the A-E bands, on the old 0-3 scale. */
export const isLegacy = (attempt: JournalAttempt): boolean =>
  attempt.criteria.some((c) => c.scale === 'legacy');

/** Parses every file, counting the ones that will not parse. */
export function parseAll(files: { name: string; text: string }[]): {
  attempts: JournalAttempt[];
  unparsed: number;
} {
  const attempts: JournalAttempt[] = [];
  let unparsed = 0;
  for (const { name, text } of files) {
    const attempt = parseJournalAttempt(name, text);
    if (attempt) attempts.push(attempt);
    else unparsed++;
  }
  return { attempts, unparsed };
}

/** All Attempts on the same Task as `file`, oldest first. */
export function taskGroup(attempts: JournalAttempt[], file: string): JournalAttempt[] {
  const key = taskKey(file);
  return attempts
    .filter((a) => sameTask(taskKey(a.file), key))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** expo-router hands a repeated query param over as an array; the first value wins. */
export const routeParam = (param: string | string[] | undefined): string =>
  (Array.isArray(param) ? param[0] : param) ?? '';
