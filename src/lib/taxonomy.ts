/**
 * The closed Error category list from CONTEXT.md.
 *
 * This list is closed on purpose. Free-form labels cannot be counted: the same
 * underlying problem comes back under a different name each time, so nothing
 * ever appears to recur and the Mistake pattern view stays empty while the
 * learner makes the same error daily.
 *
 * Adding a category invalidates the counts in existing journal entries. Do it
 * deliberately, not casually.
 */

export const ERROR_GROUPS = {
  verb: 'Verb',
  nominal: 'Nominal',
  sentence: 'Satzbau',
  lexis: 'Wortschatz',
  register: 'Register & Aufgabe',
} as const;

export type ErrorGroup = keyof typeof ERROR_GROUPS;

export type ErrorCategory = {
  id: string;
  group: ErrorGroup;
  label: string;
  /** Shown to the learner, and given to the model so it classifies consistently. */
  hint: string;
};

export const ERROR_CATEGORIES = [
  // Verb
  { id: 'perfekt-auxiliary', group: 'verb', label: 'Perfekt: sein/haben', hint: 'wrong auxiliary in the Perfekt (ich habe gegangen → ich bin gegangen)' },
  { id: 'participle-form', group: 'verb', label: 'Partizip II', hint: 'wrong past participle form (gegeht, gebringt)' },
  { id: 'verb-final', group: 'verb', label: 'Verb am Satzende', hint: 'conjugated verb not final in a subordinate clause (weil ich habe Zeit)' },
  { id: 'verb-second', group: 'verb', label: 'Verb an Position 2', hint: 'verb not in second position in a main clause' },
  { id: 'separable-prefix', group: 'verb', label: 'Trennbares Verb', hint: 'separable prefix not separated, or placed wrongly' },
  { id: 'modal-form', group: 'verb', label: 'Modalverb', hint: 'wrong modal verb form or construction' },
  { id: 'tense-choice', group: 'verb', label: 'Zeitform', hint: 'wrong tense for the context (Präteritum vs Perfekt, Futur)' },
  { id: 'konjunktiv', group: 'verb', label: 'Konjunktiv II', hint: 'Konjunktiv II form or use (wäre, hätte, würde, könnte)' },
  { id: 'passive', group: 'verb', label: 'Passiv', hint: 'passive construction formed wrongly' },
  { id: 'reflexive', group: 'verb', label: 'Reflexivpronomen', hint: 'missing or wrong reflexive pronoun (ich freue → ich freue mich)' },
  // Nominal
  { id: 'case-after-preposition', group: 'nominal', label: 'Kasus nach Präposition', hint: 'wrong case after a preposition, including Wechselpräpositionen (mit meine Freundin)' },
  { id: 'case-after-verb', group: 'nominal', label: 'Kasus nach Verb', hint: 'wrong case governed by the verb (ich helfe dich)' },
  { id: 'gender', group: 'nominal', label: 'Genus', hint: 'wrong article gender (das Tisch)' },
  { id: 'plural-form', group: 'nominal', label: 'Pluralform', hint: 'wrong plural form (die Buchs)' },
  { id: 'adjective-ending', group: 'nominal', label: 'Adjektivendung', hint: 'wrong adjective declension ending (ein guter Idee)' },
  { id: 'pronoun', group: 'nominal', label: 'Pronomen', hint: 'wrong personal or possessive pronoun' },
  { id: 'relative-clause', group: 'nominal', label: 'Relativsatz', hint: 'wrong relative pronoun or relative clause structure' },
  // Sentence
  { id: 'word-order', group: 'sentence', label: 'Wortstellung', hint: 'word order beyond verb position, e.g. TeKaMoLo (time, cause, manner, place)' },
  { id: 'connector', group: 'sentence', label: 'Konnektor', hint: 'wrong or missing conjunction/connector (weil vs denn, trotzdem vs obwohl)' },
  { id: 'comparative', group: 'sentence', label: 'Komparativ/Superlativ', hint: 'wrong comparative or superlative form' },
  // Lexis
  { id: 'word-choice', group: 'lexis', label: 'Wortwahl', hint: 'a real German word, but the wrong one for this meaning' },
  { id: 'collocation', group: 'lexis', label: 'Kollokation', hint: 'words that do not go together (einen Termin machen → vereinbaren)' },
  { id: 'false-friend', group: 'lexis', label: 'False Friend', hint: 'false friend or anglicism (bekommen for become, Handy misuse)' },
  { id: 'spelling', group: 'lexis', label: 'Rechtschreibung', hint: 'spelling, including ß/ss and umlauts' },
  { id: 'capitalisation', group: 'lexis', label: 'Groß-/Kleinschreibung', hint: 'nouns not capitalised, or non-nouns capitalised' },
  // Register & task
  { id: 'register', group: 'register', label: 'Register (du/Sie)', hint: 'du/Sie mismatch, or formal/informal tone wrong for the task' },
  { id: 'task-requirement', group: 'register', label: 'Aufgabenpunkt fehlt', hint: 'a content point the task required was not addressed' },
  { id: 'length', group: 'register', label: 'Länge', hint: 'word count outside the range the task asks for' },
] as const satisfies readonly ErrorCategory[];

export type ErrorCategoryId = (typeof ERROR_CATEGORIES)[number]['id'];

export const ERROR_CATEGORY_IDS = ERROR_CATEGORIES.map((c) => c.id) as ErrorCategoryId[];

const BY_ID = new Map(ERROR_CATEGORIES.map((c) => [c.id as string, c as ErrorCategory]));

export function categoryById(id: string): ErrorCategory | undefined {
  return BY_ID.get(id);
}

export function categoryLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** The taxonomy as prompt text, so the model classifies into these and nothing else. */
export function taxonomyForPrompt(): string {
  return ERROR_CATEGORIES.map((c) => `- ${c.id}: ${c.hint}`).join('\n');
}
