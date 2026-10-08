import type { Task } from './types';

/**
 * The Schreiben Aufgaben the app practises on.
 *
 * Source: Resources/B1_Uebungssatz_Erwachsene.pdf, page 24, transcribed as
 * printed. The learner is sitting the adult exam, so the Jugendliche paper in
 * Resources/ is reference material only and is never a task source.
 *
 * The Modellsatz is deliberately absent. Per the design behind docs/adr/0001 the
 * Übungssatz is both the practice set and the few-shot exemplar set that
 * buildTaskPrompt copies, while the Modellsatz is held back so it can serve as a
 * cold timed mock in the final fortnight. Do not add Modellsatz tasks here;
 * `source: 'modellsatz'` stays reserved for that.
 *
 * `source` is 'seed' because in this codebase that means "ships in tasks.ts", as
 * opposed to 'generated'. It no longer means placeholder.
 *
 * Leitpunkte: the paper prints bullets for Aufgabe 1 only. The `points` for
 * Aufgabe 2 and Aufgabe 3 are derived from those tasks' own instructions and are
 * marked below, because Erfüllung is scored against this list. Timings (20, 25
 * and 15 minutes) and word targets (circa 80, 80 and 40) are as printed in the
 * Übungssatz, and match the Modellsatz.
 */
export const SEED_TASKS: Task[] = [
  {
    id: 'ue-erw-t1-online-lernen',
    teil: 1,
    title: 'Aufgabe 1 — E-Mail über das Online-Lernen',
    instruction:
      'Sie haben online Deutsch gelernt und berichten Ihrer Freundin/Ihrem Freund darüber.\n\n' +
      'Achten Sie auf den Textaufbau (Anrede, Einleitung, Reihenfolge der Inhaltspunkte, Schluss).',
    // Printed on the paper as three bullets.
    points: [
      'Beschreiben Sie: Wie haben Sie gelernt?',
      'Begründen Sie: Welche Vorteile hat das Lernen mit dem Computer?',
      'Machen Sie einen Vorschlag für ein Treffen.',
    ],
    register: 'informell',
    targetWords: 80,
    minutes: 20,
    source: 'seed',
  },
  {
    id: 'ue-erw-t2-feste-arbeitszeiten',
    teil: 2,
    title: 'Aufgabe 2 — Forumsbeitrag zu Arbeitszeiten',
    // The Gästebuch post lives in the instruction because the Aufgabe cannot be
    // answered without it and Task has no separate stimulus field.
    instruction:
      'Sie haben im Fernsehen eine Diskussionssendung zum Thema „Feste Arbeitszeiten“ gesehen. ' +
      'Im Online-Gästebuch der Sendung finden Sie folgende Meinung:\n\n' +
      'Jessica, 05.01. 17:23 Uhr:\n' +
      '„Ich arbeite von 9.00 bis 17.30 Uhr. Die festen Arbeitszeiten sind schon praktisch: ' +
      'Ich habe einen geregelten Tagesablauf, kann pünktlich das Büro verlassen und bin für ' +
      'Kunden immer zu erreichen. Seitdem ich zwei kleine Kinder habe, wäre ich jedoch gerne ' +
      'flexibler.“\n\n' +
      'Schreiben Sie nun Ihre Meinung zum Thema.',
    // Derived: the paper prints no Leitpunkte for Aufgabe 2.
    points: ['Nennen Sie Ihre Meinung zum Thema.', 'Begründen Sie Ihre Meinung.'],
    register: 'informell',
    targetWords: 80,
    minutes: 25,
    source: 'seed',
  },
  {
    id: 'ue-erw-t3-kurs-absage',
    teil: 3,
    title: 'Aufgabe 3 — Absage an den Kursleiter',
    instruction:
      'Sie haben sich für den Kurs „Erfolgreich präsentieren“ angemeldet. ' +
      'Zu dem ersten Termin können Sie aber nicht kommen.\n\n' +
      'Schreiben Sie an Ihren Kursleiter, Herrn Weber.\n' +
      'Vergessen Sie nicht die Anrede und den Gruß am Schluss.',
    // Derived: split from the paper's own instruction, which is not bulleted.
    points: ['Entschuldigen Sie sich höflich.', 'Berichten Sie, warum Sie nicht kommen können.'],
    register: 'formell',
    targetWords: 40,
    minutes: 15,
    source: 'seed',
  },
];

export function taskById(id: string): Task | undefined {
  return SEED_TASKS.find((t) => t.id === id);
}
