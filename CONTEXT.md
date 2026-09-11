# DeutschZiel

A German exam-preparation tutor for learners sitting Goethe or telc B1/B2. This file is the project's glossary: it fixes the meaning of terms that are ambiguous, overloaded, or used inconsistently in everyday speech about the domain. It contains no implementation detail.

## Learner and level

**Learner**:
A person preparing for a German exam with this app. Their material, progress and mistakes are theirs alone and are never pooled with anyone else's.
_Avoid_: user, student, account, candidate

**Skill**:
One of the four exam competences: Lesen, Hören, Schreiben, Sprechen. Always referred to by its German name.
_Avoid_: area, category, section

**Current level**:
What the Learner can comfortably do now in a given Skill, expressed on the CEFR scale. Tracked per Skill, never as a single blended number.

**Target level**:
The CEFR level the Learner's chosen exam requires. A property of the exam, not of the Learner's ability.

**Challenge level**:
The level the Learner should practise at next to close the gap between Current and Target. Usually at or just above Current level, and not necessarily equal to Target.

## Exam structure

**Exam**:
A specific certificate at a specific level, such as Goethe-Zertifikat B1. Modelled as data — modules, Teile, timing, scoring, instructions — never inferred from uploaded documents.

**Module**:
One of the four independently booked, independently scored and independently passable parts of a Goethe exam, one per Skill. A Learner can retake a single failed Module rather than the whole Exam, which makes the Module the natural unit of preparation strategy.
_Avoid_: paper, section, part

**Teil**:
A numbered subdivision within a Module, such as Sprechen Teil 2, the presentation. Always the German word, always with its number, because the Teil number is how learners and official materials refer to them.
_Avoid_: part, subsection, exercise type

**Criterion**:
One of the named dimensions an examiner scores a Submission against — for Schreiben: Erfüllung (task fulfilment), Kohärenz, Wortschatz, and Strukturen. The canonical names and their descriptors come from the official Bewertungskriterien, not from this file.
_Avoid_: rubric, metric, dimension

**Modellsatz**:
An official published sample exam paper. Used as the authoritative reference for format and difficulty, and held back from routine practice so it stays usable as a cold, timed mock.
_Avoid_: sample paper, past paper, mock

## Practice

**Task**:
A single thing the Learner is asked to do — write a forum post, present a topic, answer a comprehension question. A Task states its requirements, its Teil, and its expected length or duration. This is the only word for this concept; the source document's "question", "exercise" and "item" all mean Task.
_Avoid_: question, exercise, item, prompt, activity

**Submission**:
What the Learner produced for one Task, as text or as audio. Raw and unjudged.
_Avoid_: answer, response, entry

**Feedback**:
The assessment of one Submission: Criterion scores, the Correction tiers, and the Mistake instances found in it.
_Avoid_: correction, evaluation, review, grading

**Attempt**:
One Task, one Submission, and its Feedback, taken together. The unit of practice history. Doing the same Task again produces a second Attempt, which is what makes before-and-after comparison possible.
_Avoid_: session, try, run

**Correction tier**:
One of three parallel rewrites of the Learner's Submission, each answering a different question. **Correct** is the minimally repaired version — what they wrote, made right. **Simpler** is how a confident B1 speaker would more naturally say the same thing. **More advanced** deliberately reaches above the Learner's Target level and is labelled as a stretch, not as the expected answer.
_Avoid_: suggestion, alternative, improvement, variant

## Mistakes

**Mistake instance**:
One error in one Submission: the offending span, the wrong form, the right form, and exactly one Error category. Instances are the raw record and are never counted directly.
_Avoid_: error, issue, correction

**Error category**:
A label from the closed list below. Every Mistake instance carries exactly one. The list is closed on purpose: free-form labels cannot be counted, because the same underlying problem comes back under a different name each time and nothing ever appears to recur.
_Avoid_: error type, tag, label

**Mistake pattern**:
An Error category that recurs across a Learner's Attempts, together with its frequency and trend. Patterns are what the Learner is shown and what the Task generator aims at; instances are what patterns are computed from.
_Avoid_: weakness, weak area, recurring mistake

### The closed Error category list

Verb:
`perfekt-auxiliary` · `participle-form` · `verb-final` · `verb-second` · `separable-prefix` · `modal-form` · `tense-choice` · `konjunktiv` · `passive` · `reflexive`

Nominal:
`case-after-preposition` · `case-after-verb` · `gender` · `plural-form` · `adjective-ending` · `pronoun` · `relative-clause`

Sentence:
`word-order` · `connector` · `comparative`

Lexis:
`word-choice` · `collocation` · `false-friend` · `spelling` · `capitalisation`

Register and task:
`register` · `task-requirement` · `length`

Pronunciation and fluency are deliberately absent. Whether they can be assessed at all depends on how much of a spoken error survives into what the model actually receives, and until that is measured, a category for them would invite claims the system cannot support.

## Roles the tutor plays

**Partner**:
The simulated fellow candidate in Sprechen Teil 1 and Teil 3. A Partner is another B1 learner — hesitant, plainly spoken, occasionally wrong — not a fluent native and not a teacher. A Partner never corrects the Learner, because correction ends the simulation, and never dominates the exchange, because airtime is assessed.
_Avoid_: bot, assistant, interlocutor

**Examiner**:
The role that produces Feedback, always after an Attempt has finished. Kept strictly separate from Partner: two roles, two moments, never mixed.
_Avoid_: tutor, grader, teacher

## Material

**Material**:
A document a Learner can retrieve from — a textbook, a word list, a transcript, an official sample paper. Either default Material, available to everyone, or personal Material, owned by exactly one Learner and visible only to them.
_Avoid_: content, resource, upload, source

**Wortliste**:
The official Goethe vocabulary list for a level. Not merely reference Material but a constraint: it defines the vocabulary ceiling for the Correct and Simpler Correction tiers, and by exclusion it defines what More advanced means.

**Readiness**:
An internal estimate of how prepared a Learner is for their Exam, derived from their own Attempts. A progress indicator, not a prediction of passing — there is no exam-outcome data to calibrate it against, and it should never be presented as though there were.
_Avoid_: score, pass probability, prediction
