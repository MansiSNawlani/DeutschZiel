/**
 * Attempts are written to disk as Markdown, not into a database.
 *
 * A browser cannot write into the repo on its own, so this uses the File System
 * Access API: the learner grants access to the journal/ folder once, the handle
 * is kept in IndexedDB, and every attempt afterwards lands as a real file. That
 * API is Chromium-only, so anywhere else falls back to downloading each file.
 *
 * journal/ is gitignored — the repo is public and these are personal writings.
 */

import {
  type Band,
  type Total,
  bandPoints,
  formatPoints,
  schreibenMax,
  schreibenTotal,
  sprechenMax,
  sprechenTeil2Total,
} from './bewertung';
import { type AttemptRecord, parseAttemptRecord } from './patterns';
import type { SpeakingFeedback, SpeakingTask } from './speaking';
import { categoryLabel } from './taxonomy';
import type { Attempt } from './types';

type DirHandle = {
  name: string;
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
  values(): AsyncIterableIterator<{ kind: string; name: string }>;
};

type FileHandle = {
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
};

const DB = 'deutschziel';
const STORE = 'handles';
const HANDLE_KEY = 'journal-dir';

export const isSupported = (): boolean =>
  typeof globalThis !== 'undefined' && 'showDirectoryPicker' in globalThis;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Prompts for the journal/ folder. Must be called from a user gesture. */
export async function chooseFolder(): Promise<string> {
  const picker = (globalThis as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> })
    .showDirectoryPicker;
  const handle = await picker({ mode: 'readwrite' });
  await idbSet(HANDLE_KEY, handle);
  return handle.name;
}

/** The stored folder, if the grant is still live. Never prompts. */
async function storedFolder(): Promise<DirHandle | null> {
  try {
    const handle = await idbGet<DirHandle>(HANDLE_KEY);
    if (!handle) return null;
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return handle;
    return null;
  } catch {
    return null;
  }
}

export async function folderName(): Promise<string | null> {
  const dir = await storedFolder();
  return dir?.name ?? null;
}

export type FolderAccess = 'unsupported' | 'none' | 'needs-permission' | 'ready';

/**
 * storedFolder() answers null both when no folder was ever chosen and when the
 * grant lapsed on reload; a screen offering "reconnect" has to tell them apart.
 * Never prompts.
 */
export async function folderAccess(): Promise<FolderAccess> {
  if (!isSupported()) return 'unsupported';
  const handle = await idbGet<DirHandle>(HANDLE_KEY);
  if (!handle) return 'none';
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
    ? 'ready'
    : 'needs-permission';
}

/** Re-grants access after a page reload. Must be called from a user gesture. */
export async function reconnectFolder(): Promise<boolean> {
  const handle = await idbGet<DirHandle>(HANDLE_KEY);
  if (!handle) return false;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function writeFile(name: string, content: string): Promise<'saved' | 'downloaded'> {
  const dir = await storedFolder();
  if (dir) {
    const file = await dir.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(content);
    await writable.close();
    return 'saved';
  }
  download(name, content);
  return 'downloaded';
}

async function readFile(name: string): Promise<string | null> {
  const dir = await storedFolder();
  if (!dir) return null;
  try {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Down to the second, because writeFile overwrites: with minutes only, a
 * second Attempt on the same Task inside one minute replaced the first.
 */
function fileStamp(createdAt: string): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function fileNameFor(attempt: Attempt): string {
  return `${fileStamp(attempt.createdAt)}-${attempt.task.id}.md`;
}

/**
 * Entries written before the A-E bands keep their old `n/3` lines; anything
 * that reads criteria back has to accept both.
 */
function criteriaToMarkdown<C extends string>(
  criteria: { criterion: C; band: Band; comment: string }[],
  maxOf: (criterion: C) => number,
  { points, max }: Total,
): string[] {
  return [
    ...criteria.map((c) => {
      const cMax = maxOf(c.criterion);
      return `- **${c.criterion}** ${c.band} (${formatPoints(bandPoints(c.band, cMax))}/${cMax}) - ${c.comment}`;
    }),
    `- **Total** ${formatPoints(points)} / ${max}`,
  ];
}

export function attemptToMarkdown(a: Attempt): string {
  const { task, feedback } = a;
  const tick = '`';
  return [
    '---',
    `task: ${task.id}`,
    `teil: ${task.teil}`,
    `date: ${a.createdAt}`,
    `words: ${a.wordCount} (target ${task.targetWords})`,
    `minutes: ${Math.round(a.secondsSpent / 60)} (allowed ${task.minutes})`,
    `categories: ${feedback.mistakes.map((m) => m.category).join(', ') || 'none'}`,
    '---',
    '',
    `# ${task.title}`,
    '',
    task.instruction,
    '',
    ...task.points.map((p, i) => `${i + 1}. ${p}`),
    '',
    '## Submission',
    '',
    a.submission,
    '',
    '## Criteria',
    '',
    ...criteriaToMarkdown(
      feedback.criteria,
      (c) => schreibenMax(task.teil, c),
      schreibenTotal(task.teil, feedback.criteria),
    ),
    '',
    '## Correct',
    '',
    feedback.tiers.correct,
    '',
    '## Simpler',
    '',
    feedback.tiers.simpler,
    '',
    '## More advanced',
    '',
    feedback.tiers.advanced,
    '',
    '## Mistakes',
    '',
    ...(feedback.mistakes.length
      ? feedback.mistakes.map(
          (m) =>
            `- ${tick}${m.category}${tick} **${m.span}** → **${m.correction}**\n  ${m.explanation}`,
        )
      : ['None found.']),
    '',
    '## Summary',
    '',
    feedback.summary,
    '',
  ].join('\n');
}

export type PatternCount = { category: string; count: number };

/**
 * Mistake patterns: Error categories counted across attempts. Instances live in
 * the per-attempt files; this aggregate is what the learner actually sees, and
 * what the task generator will eventually aim at.
 */
export async function loadPatterns(): Promise<PatternCount[]> {
  const raw = await readFile('mistakes.md');
  if (!raw) return [];
  const counts: PatternCount[] = [];
  for (const line of raw.split('\n')) {
    const match = /^\|\s*`([a-z-]+)`\s*\|\s*(\d+)\s*\|/.exec(line);
    if (match) counts.push({ category: match[1], count: Number(match[2]) });
  }
  return counts;
}

function patternsToMarkdown(patterns: PatternCount[], attempts: number): string {
  const tick = '`';
  const sorted = [...patterns].sort((a, b) => b.count - a.count);
  return [
    '# Mistake patterns',
    '',
    `Aggregated from ${attempts} attempt${attempts === 1 ? '' : 's'}. This file is regenerated on`,
    'every save — edit the attempt files, not this one.',
    '',
    '| category | count | what it is |',
    '| --- | --- | --- |',
    ...sorted.map((p) => `| ${tick}${p.category}${tick} | ${p.count} | ${categoryLabel(p.category)} |`),
    '',
  ].join('\n');
}

const isAttemptFile = (entry: { kind: string; name: string }): boolean =>
  entry.kind === 'file' && entry.name.endsWith('.md') && entry.name !== 'mistakes.md';

async function countAttemptFiles(): Promise<number> {
  const dir = await storedFolder();
  if (!dir) return 0;
  let n = 0;
  for await (const entry of dir.values()) {
    if (isAttemptFile(entry)) n++;
  }
  return n;
}

/**
 * Every Attempt file in the folder, parsed for the pattern view. A file that cannot be
 * read or has no usable frontmatter is counted, not thrown on, so one bad file
 * cannot hide the rest. Null when the grant is gone, so a lapsed folder is not
 * mistaken for an empty one.
 */
export async function readAttemptRecords(): Promise<{
  records: AttemptRecord[];
  unreadable: number;
} | null> {
  const dir = await storedFolder();
  if (!dir) return null;
  const records: AttemptRecord[] = [];
  let unreadable = 0;
  for await (const entry of dir.values()) {
    if (!isAttemptFile(entry)) continue;
    try {
      const file = await (await dir.getFileHandle(entry.name)).getFile();
      const record = parseAttemptRecord(await file.text());
      if (record) records.push(record);
      else unreadable++;
    } catch {
      unreadable++;
    }
  }
  return { records, unreadable };
}

/** Folds new Error categories into mistakes.md. Skill-agnostic on purpose: a
 * case error is the same weakness whether it was written or spoken, and splitting
 * the counts would hide exactly the pattern the aggregate exists to surface. */
async function recordPatterns(categories: string[]): Promise<void> {
  const counts = new Map((await loadPatterns()).map((p) => [p.category, p.count]));
  for (const category of categories) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const merged = [...counts].map(([category, count]) => ({ category, count }));
  await writeFile('mistakes.md', patternsToMarkdown(merged, (await countAttemptFiles()) || 1));
}

/** Writes the attempt file, then refreshes the running pattern aggregate. */
export async function saveAttempt(attempt: Attempt): Promise<'saved' | 'downloaded'> {
  const result = await writeFile(fileNameFor(attempt), attemptToMarkdown(attempt));
  await recordPatterns(attempt.feedback.mistakes.map((m) => m.category));
  return result;
}

export type SpeakingAttempt = {
  task: SpeakingTask;
  feedback: SpeakingFeedback;
  seconds: number;
  createdAt: string;
};

function speakingToMarkdown(a: SpeakingAttempt): string {
  const tick = '`';
  const { task, feedback } = a;
  return [
    '---',
    `skill: sprechen`,
    `teil: 2`,
    `topic: ${task.topic}`,
    `date: ${a.createdAt}`,
    `seconds: ${a.seconds} (target ${task.targetSeconds})`,
    `categories: ${feedback.mistakes.map((m) => m.category).join(', ') || 'none'}`,
    '---',
    '',
    `# Sprechen Teil 2 — ${task.topic}`,
    '',
    '## Transcript',
    '',
    '> What the model heard. If this reads cleaner than what you actually said, the',
    '> grammar judgements below are unreliable.',
    '',
    feedback.transcript,
    '',
    '## Folien',
    '',
    ...feedback.folien.map((f) => `- ${f.covered ? '✓' : '✗'} **Folie ${f.folie}** — ${f.comment}`),
    '',
    '## Criteria',
    '',
    ...criteriaToMarkdown(feedback.criteria, sprechenMax, sprechenTeil2Total(feedback.criteria)),
    '',
    '## Mistakes',
    '',
    ...(feedback.mistakes.length
      ? feedback.mistakes.map(
          (m) => `- ${tick}${m.category}${tick} **${m.said}** → **${m.correction}**\n  ${m.explanation}`,
        )
      : ['None found.']),
    '',
    '## Better phrasings',
    '',
    ...(feedback.betterPhrasings.length
      ? feedback.betterPhrasings.map((p) => `- **${p.said}** → **${p.better}**\n  ${p.why}`)
      : ['None suggested.']),
    '',
    '## Summary',
    '',
    feedback.summary,
    '',
  ].join('\n');
}

export async function saveSpeakingAttempt(a: SpeakingAttempt): Promise<'saved' | 'downloaded'> {
  const result = await writeFile(`${fileStamp(a.createdAt)}-sprechen-${a.task.id}.md`, speakingToMarkdown(a));
  await recordPatterns(a.feedback.mistakes.map((m) => m.category));
  return result;
}
