/**
 * The official Goethe-Zertifikat B1 Wortliste, extracted from the published PDF
 * in Resources/ (2740 headwords).
 *
 * This is not reference material, it is a constraint: it defines the vocabulary
 * ceiling for the Correct and Simpler correction tiers, and by exclusion it
 * defines what More advanced means. See CONTEXT.md.
 */

import headwords from './data/wortliste-b1.json';

const SET = new Set(headwords as string[]);

export const WORTLISTE_SIZE = SET.size;

/** Strips inflection crudely; good enough to flag obviously out-of-scope words. */
function stems(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-zäöüß-]/g, '');
  if (!w) return [];
  const out = [w];
  for (const suffix of ['en', 'em', 'er', 'es', 'e', 'n', 's', 'te', 'ten', 'st']) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) out.push(w.slice(0, -suffix.length));
  }
  return out;
}

export function isB1Word(word: string): boolean {
  return stems(word).some((s) => SET.has(s));
}

/**
 * Words in `text` that are not in the B1 list. Advisory only: the stemmer is
 * crude and compounds are legitimately absent from the list, so this flags
 * candidates for a human to judge, it does not assert an error.
 */
export function aboveB1(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/[^A-Za-zÄÖÜäöüß-]+/)) {
    if (raw.length < 4) continue;
    const w = raw.toLowerCase();
    if (seen.has(w) || isB1Word(raw)) continue;
    seen.add(w);
  }
  return [...seen];
}

/** The list as prompt text, capping the vocabulary the model may use. */
export function wortlisteForPrompt(): string {
  return (headwords as string[]).join(', ');
}
