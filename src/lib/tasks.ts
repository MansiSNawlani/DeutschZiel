import type { Task } from './types';

/**
 * Seed Schreiben tasks, shaped like Goethe B1 Aufgaben 1-3.
 *
 * These are PLACEHOLDERS. The agreed design (see the design session behind
 * docs/adr/0001) is that the official Modellsatz and Übungssatz tasks act as
 * few-shot exemplars for generated variations, and are themselves held back for
 * cold timed mocks in the final fortnight. Those papers are not in Resources/
 * yet. Replace `source: 'seed'` entries with real ones once they are.
 *
 * Timings and word targets follow the published Goethe B1 format; verify them
 * against the Modellsatz rather than trusting this file.
 */
export const SEED_TASKS: Task[] = [
  {
    id: 'seed-t1-umzug',
    teil: 1,
    title: 'Aufgabe 1 — E-Mail an eine Freundin',
    instruction:
      'Ihre Freundin Sabine ist letzte Woche in eine andere Stadt umgezogen. Schreiben Sie ihr eine E-Mail.',
    points: [
      'Fragen Sie, wie es ihr in der neuen Wohnung geht.',
      'Berichten Sie, was Sie letztes Wochenende gemacht haben.',
      'Schlagen Sie vor, wann Sie sie besuchen könnten.',
    ],
    register: 'informell',
    targetWords: 80,
    minutes: 20,
    source: 'seed',
  },
  {
    id: 'seed-t2-homeoffice',
    teil: 2,
    title: 'Aufgabe 2 — Forumsbeitrag',
    instruction:
      'Sie lesen in einem Online-Forum einen Beitrag zum Thema „Arbeiten von zu Hause aus“. Schreiben Sie Ihre Meinung dazu.',
    points: [
      'Nennen Sie Ihre Meinung zum Thema.',
      'Begründen Sie Ihre Meinung mit mindestens zwei Argumenten.',
      'Berichten Sie von einer eigenen Erfahrung.',
    ],
    register: 'informell',
    targetWords: 80,
    minutes: 25,
    source: 'seed',
  },
  {
    id: 'seed-t3-absage',
    teil: 3,
    title: 'Aufgabe 3 — Formelle E-Mail',
    instruction:
      'Sie können morgen nicht zu einem Termin bei Frau Dr. Weber kommen. Schreiben Sie eine E-Mail an die Praxis.',
    points: [
      'Entschuldigen Sie sich und sagen Sie den Termin ab.',
      'Nennen Sie einen Grund.',
      'Bitten Sie um einen neuen Termin.',
    ],
    register: 'formell',
    targetWords: 40,
    minutes: 15,
    source: 'seed',
  },
];

export function taskById(id: string): Task | undefined {
  return SEED_TASKS.find((t) => t.id === id);
}
