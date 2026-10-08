/**
 * The Goethe B1 Bewertungskriterien and Bewertungsbogen, transcribed from the
 * Übungssatz (Erwachsene) and checked word for word against the Modellsatz.
 *
 * The examiner scores each Criterion A to E, and each band is worth points that
 * differ by Teil and Criterion. An E on Erfüllung makes the whole Aufgabe worth
 * 0, however good the German is. The descriptors stay in German and verbatim,
 * because they are the contract the model is scoring against.
 */

export const BANDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type Band = (typeof BANDS)[number];

export const SCHREIBEN_CRITERIA = ['Erfüllung', 'Kohärenz', 'Wortschatz', 'Strukturen'] as const;
export type SchreibenCriterion = (typeof SCHREIBEN_CRITERIA)[number];

/** Sprechen Teil 2 has the same four as Schreiben, plus Aussprache for the whole Module. */
export const SPRECHEN_CRITERIA = [...SCHREIBEN_CRITERIA, 'Aussprache'] as const;
export type SprechenCriterion = (typeof SPRECHEN_CRITERIA)[number];

/** Every table on the Bewertungsbogen steps down in quarters of the maximum. */
const BAND_SHARE: Record<Band, number> = { A: 1, B: 0.75, C: 0.5, D: 0.25, E: 0 };

const SCHREIBEN_MAX: Record<1 | 2 | 3, Record<SchreibenCriterion, number>> = {
  1: { Erfüllung: 10, Kohärenz: 10, Wortschatz: 10, Strukturen: 10 },
  2: { Erfüllung: 10, Kohärenz: 10, Wortschatz: 10, Strukturen: 10 },
  3: { Erfüllung: 4, Kohärenz: 4, Wortschatz: 6, Strukturen: 6 },
};

/** Sprechen Teil 2 plus Aussprache, which the exam scores once across Teil 1-3. */
const SPRECHEN_MAX: Record<SprechenCriterion, number> = {
  Erfüllung: 12,
  Kohärenz: 4,
  Wortschatz: 12,
  Strukturen: 12,
  Aussprache: 16,
};

export function schreibenMax(teil: 1 | 2 | 3, criterion: SchreibenCriterion): number {
  return SCHREIBEN_MAX[teil][criterion];
}

export function sprechenMax(criterion: SprechenCriterion): number {
  return SPRECHEN_MAX[criterion];
}

export function bandPoints(band: Band, max: number): number {
  return BAND_SHARE[band] * max;
}

export type Total = { points: number; max: number; zeroed: boolean };
type Scored = { criterion: string; band: Band };

/**
 * The maximum comes from the official criteria, not from what the model
 * returned, so a criterion it leaves out scores 0 instead of shrinking the
 * maximum. Erfüllung E zeroes the whole Aufgabe.
 */
function total<C extends string>(criteria: readonly C[], scored: Scored[], maxOf: (c: C) => number): Total {
  let points = 0;
  let max = 0;
  let zeroed = false;
  for (const criterion of criteria) {
    const band = scored.find((s) => s.criterion === criterion)?.band;
    max += maxOf(criterion);
    if (band) points += bandPoints(band, maxOf(criterion));
    if (criterion === 'Erfüllung' && band === 'E') zeroed = true;
  }
  return { points: zeroed ? 0 : points, max, zeroed };
}

export function schreibenTotal(teil: 1 | 2 | 3, scored: Scored[]): Total {
  return total(SCHREIBEN_CRITERIA, scored, (c) => schreibenMax(teil, c));
}

/** Aussprache is scored for the whole Module, so it stays out of the Teil 2 total. */
export function sprechenTeil2Total(scored: Scored[]): Total {
  return total(SCHREIBEN_CRITERIA, scored, sprechenMax);
}

/** German decimal comma, as the Bewertungsbogen prints it: 7,5. */
export function formatPoints(n: number): string {
  return String(n).replace('.', ',');
}

/** The colour side of the 60 % pass mark: B (75 %) is above it, C (50 %) below. */
export function bandTone(band: Band): 'success' | 'warning' | 'danger' {
  if (band === 'A' || band === 'B') return 'success';
  return band === 'C' ? 'warning' : 'danger';
}

const BEHERRSCHUNG = `vereinzelte Fehlgriffe beeinträchtigen das Verständnis nicht | mehrere Fehlgriffe beeinträchtigen das Verständnis nicht | mehrere Fehlgriffe beeinträchtigen das Verständnis teilweise | mehrere Fehlgriffe beeinträchtigen das Verständnis erheblich`;
const SPEKTRUM = `differenziert | überwiegend angemessen | teilweise angemessen oder begrenzt | kaum vorhanden`;
const REGISTER = `situations- und partneradäquat | noch weitgehend situations- und partneradäquat | ansatzweise situations- und partneradäquat | nicht mehr situations- und partneradäquat`;

/** Bands are listed A | B | C | D, then E on its own line. */
export const SCHREIBEN_KRITERIEN = `Erfüllung, Aufgabe 1 (Inhalt, Umfang, Sprachfunktionen; Textsorte; Register/Soziokulturelle Angemessenheit):
- Sprachfunktionen: Alle 3 Sprachfunktionen inhaltlich und umfänglich angemessen behandelt | 2 Sprachfunktionen angemessen oder 1 angemessen und 2 teilweise | 1 Sprachfunktion angemessen und 1 teilweise oder alle teilweise | 1 Sprachfunktion angemessen oder teilweise
- Textsorte: durchgängig umgesetzt | erkennbar | ansatzweise erkennbar | kaum erkennbar
- Register/Soziokulturelle Angemessenheit: ${REGISTER}
- E: Textumfang weniger als 50 % der geforderten Wortanzahl oder Thema verfehlt

Erfüllung, Aufgabe 2 (Inhalt, Umfang, Meinungsäußerung; Register/Soziokulturelle Angemessenheit):
- Meinungsäußerung: inhaltlich und umfänglich angemessen | überwiegend angemessen | teilweise angemessen | kaum angemessen
- Register/Soziokulturelle Angemessenheit: ${REGISTER}
- E: Textumfang weniger als 50 % der geforderten Wortanzahl oder Thema verfehlt

Erfüllung, Aufgabe 3 (Mitteilung, Inhalt, Register/Soziokulturelle Angemessenheit):
- Mitteilung inhaltlich und soziokulturell angemessen | überwiegend angemessen | stellenweise angemessen | kaum angemessen
- E: Textumfang weniger als 50 % der geforderten Wortanzahl oder Thema verfehlt

Kohärenz, all Aufgaben:
- Textaufbau (z. B. Einleitung, Schluss): durchgängig und effektiv | überwiegend erkennbar | stellenweise erkennbar | kaum erkennbar
- Verknüpfung von Sätzen, Satzteilen: angemessen | überwiegend angemessen | teilweise angemessen | kaum angemessen
- E: Text durchgängig unangemessen

Wortschatz, all Aufgaben:
- Spektrum: ${SPEKTRUM}
- Beherrschung: ${BEHERRSCHUNG}
- E: Text durchgängig unangemessen

Strukturen, all Aufgaben:
- Spektrum: ${SPEKTRUM}
- Beherrschung (Morphologie, Syntax, Orthografie): ${BEHERRSCHUNG}
- E: Text durchgängig unangemessen

Wird das Kriterium „Erfüllung“ mit E (0 Punkten) bewertet, ist die Punktzahl für diese Aufgabe insgesamt 0 Punkte.`;

/** Bands are listed A | B | C | D, then E on its own line. */
export const SPRECHEN_TEIL2_KRITERIEN = `Erfüllung (Vollständigkeit, Inhalt, Umfang):
- Alle 5 Folien in Inhalt und Umfang angemessen behandelt | 3-4 Folien in Inhalt und Umfang angemessen behandelt | 2 Folien in Inhalt und Umfang angemessen behandelt oder alle Folien zu knapp | 1 Folie in Inhalt und Umfang angemessen behandelt
- E: Präsentation nicht bewertbar

Kohärenz (Verknüpfung von Sätzen und Satzteilen, nachvollziehbarer Gedankengang):
- angemessen | überwiegend angemessen | teilweise angemessen | kaum angemessen

Wortschatz:
- Register: ${REGISTER}
- Spektrum: ${SPEKTRUM}
- Beherrschung: ${BEHERRSCHUNG}
- E: Äußerung größtenteils unverständlich

Strukturen:
- Spektrum: ${SPEKTRUM}
- Beherrschung (Morphologie, Syntax): vereinzelte Fehlgriffe stören nicht | mehrere Fehlgriffe stören nicht | mehrere Fehlgriffe stören teilweise | mehrere Fehlgriffe stören erheblich
- E: Äußerung größtenteils unverständlich

Aussprache (Satzmelodie, Wortakzent, einzelne Laute):
- Keine auffälligen Abweichungen | Wahrnehmbare Abweichungen beeinträchtigen das Verständnis nicht | Abweichungen beeinträchtigen das Verständnis stellenweise | Abweichungen beeinträchtigen das Verständnis erheblich
- E: nicht mehr verständlich

Wird das Kriterium „Erfüllung“ mit E (0 Punkten) bewertet, ist die Punktzahl für diese Aufgabe insgesamt 0 Punkte.`;
