# Coding Standards

> Rewritten by `/adopt` to match what this codebase actually does. It is an
> Expo / React Native app with no backend and no database; the shipped defaults
> about Next.js, Prisma and Tailwind did not apply and have been removed.

## Domain vocabulary

`CONTEXT.md` is binding for naming. It fixes the meaning of Learner, Skill,
Task, Submission, Feedback, Attempt, Correction tier, Mistake instance, Error
category, Mistake pattern, Partner, Examiner, Material and Wortliste, and it
lists the words to avoid for each. Use those names in types, variables, comments
and UI copy. Do not introduce a synonym for a term that already has one.

The Error category list in `src/lib/taxonomy.ts` is closed on purpose. Adding a
category invalidates the counts in existing journal entries, so it is a
deliberate change, never a casual one.

German is used for exam terms (Teil, Aufgabe, Folie, Wortliste, Bewertung) and
for anything the learner sees as exam content. Mistake explanations are written
in English, so the learner reads the rule in a language they already have.

## TypeScript

- Strict mode, and it stays on.
- No `any`. Use `unknown` and narrow it.
- Prefer `type` aliases over `interface`; that is what the codebase uses
  throughout.
- Import types with `import type`.
- Use inference where it is obvious, explicit types on exported functions and on
  anything crossing a module boundary.
- Import from source with the `@/` alias, which maps to `src/`. Relative imports
  are used only between closely related files in the same folder.

## React and React Native

- Function components only, with hooks.
- `useCallback` for handlers passed down or listed in a dependency array;
  `useRef` for timers, recorders and anything that must not trigger a render.
- Read settings with `useFocusEffect`, not `useEffect`, on screens the router
  keeps mounted while another screen is pushed over them. A mount-only read
  misses changes made on the screen above.
- Clean up after yourself: clear intervals, revoke object URLs, stop media
  tracks.
- Screens own their phase state as a single union (`'choose' | 'writing' |
  'grading' | 'feedback'`) rather than several booleans that can contradict each
  other.

## Expo Router

- Routes are files under `src/app/`. `_layout.tsx` holds the Stack and its
  screen options.
- Typed routes are on (`experiments.typedRoutes`), so route strings are checked.
- Navigate with `Link` from `expo-router`.

## File organization and naming

- Routes: `src/app/<route>.tsx`
- Components: `src/components/<name>.tsx`, with shared primitives under
  `src/components/ui/`
- Hooks: `src/hooks/use-<name>.ts`
- Non-UI logic: `src/lib/<name>.ts`, one concern per module
- Static data: `src/lib/data/<name>.json`
- Constants and the palette: `src/constants/theme.ts`

Naming:

- Files: kebab-case, always, including component files
  (`feedback-view.tsx`, not `FeedbackView.tsx`)
- Components: PascalCase
- Functions and variables: camelCase
- Module-level constants: SCREAMING_SNAKE_CASE
- Types: PascalCase, no prefix

## Styling

- React Native `StyleSheet.create`, declared at the bottom of the file, below
  the component.
- No Tailwind and no styling library. `src/global.css` only declares font
  stacks.
- Colours come from `useTheme()`, never as literals in a component. Static
  layout lives in the StyleSheet and the themed colour is applied inline as
  `style={[styles.card, { backgroundColor: theme.backgroundElement }]}`.
- The palette in `src/constants/theme.ts` is semantic, not decorative. Each
  accent means one thing across the whole app: success is the Correct tier and a
  full band, primary is the Simpler tier and anything navigable, accent is the
  More advanced tier, warning is over time or over length, danger is a Mistake
  instance or a failing band. If a colour would carry no meaning, use a surface
  instead.
- Both light and dark must work. Follow the system scheme.
- Use the `Spacing` scale rather than ad hoc numbers, and `MaxContentWidth` so
  layouts stay readable in a wide browser window.

## Data and persistence

There is no backend and no database in v0, and adding one is a v1 decision, not
a step inside a feature.

- `localStorage` for settings and the in-progress Schreiben draft, always
  wrapped in try/catch. Private browsing must degrade to a working session, not
  a crash.
- IndexedDB for anything that will not fit there, which today means the
  unsubmitted Sprechen recording in `recording-draft.ts`. Same try/catch
  bargain. Give a new store its own database rather than adding a store to an
  existing one: that would mean bumping the shared database's version, and
  whichever module opened it first at the old version would fail.
- Attempts are Markdown files written through the File System Access API, with
  the directory handle kept in IndexedDB. That API is Chromium only, so every
  path through it needs the download fallback.
- Nothing personal goes in the repository. `journal/` and `Resources/` are
  gitignored, the first because the writings are personal and the repository is
  public, the second because those PDFs are copyrighted.

## The Gemini client

- All model calls go through `src/lib/gemini.ts`. Screens do not call the REST
  API directly.
- The learner's own key is used, read from settings. **Never commit a key, never
  bundle one, and never add a default key for convenience.** The whole
  bring-your-own-key design exists so that no server holds a secret.
- Model ids are discovered at runtime from the key. Do not hardcode one.
- Ask for structured output with a response schema, and keep the schema next to
  the prompt that uses it.
- The correction prompt in `src/lib/prompts.ts` is the artifact v0 exists to
  refine, and the one thing expected to survive into v1. Edit it deliberately,
  and keep the journal that shows whether an edit made it better.
- Respect the free tier. The Wortliste is the largest part of a prompt and is
  switchable for when per-minute token limits bite.

## Error handling

- Typed errors from library modules (`GeminiError` carries the HTTP status), so
  a caller can tell a bad key from a rate limit.
- Screens hold an `error` string in state and render it in place. No alerts, no
  toasts, no swallowed failures on a path the learner is waiting on.
- Storage writes may fail silently by design; a model call may not.
- Long waits show an elapsed second counter. A bare spinner cannot be told apart
  from a hang, and slow free-tier responses are normal here.

## Testing

No test runner is configured, and testing is opt-in. Run `/tests` to add one,
which will also add the real command to the Commands section of `AGENTS.md`.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and tests become a gate for logic-bearing steps;
leave it out and the loop verifies logic with the evidence it already uses,
which here means running the app in a browser and the TypeScript compiler.

When a runner is added, the scope rule is the usual one:

- **Test** pure logic where a wrong answer is possible. In this codebase that
  means the Wortliste stemming and `aboveB1` check, the taxonomy lookups, the
  Markdown journal formatting and its pattern counting, the WAV re-encoding
  maths, and the settings and draft round trips.
- **Do not test** the screens or the Gemini calls with unit tests. Verify those
  by running the app.
- An empty suite should fail, not pass, so "no tests ran" never looks like
  "passed".
- Test files sit next to their source, as `<name>.test.ts`.

## Browser verification

This is a browser app, so running it is the primary evidence.

- `npx expo start --web` and exercise the actual loop: choose a Task, write or
  record, submit, read the Feedback.
- Use Chromium specifically when the journal folder or recording is involved.
  Both the File System Access API and `MediaRecorder` behave differently
  elsewhere, and the fallback path is worth exercising too.
- Browser automation is separately opt-in through `/tests browser`. Do not add a
  runner silently in the middle of an unrelated feature.
- A Gemini call costs quota and takes real seconds. Verify what can be verified
  without one before spending it.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- This codebase does use a short block comment at the top of a `src/lib/` module,
  and that is the one accepted exception to "no banner blocks". It exists to
  record a decision the code cannot state: why there is no backend, why the
  Error category list is closed, why recordings are re-encoded to 16 kHz mono
  WAV. Write one only when there is such a decision to record.
- No section dividers or step-by-step narration of obvious code.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec, an ADR or `CONTEXT.md`.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
- This applies to new writing only. The existing files use em dashes
  deliberately and are not to be swept or reformatted.
