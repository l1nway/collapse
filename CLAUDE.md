# @l1nway/collapse

Always reply to the user in Russian. Code, comments, docs, doc-keys and commit messages are in English.

This file is the standing rulebook of the package repo. The SYNC rule (entry format, semver, judging against all consumers) and the open requests and ideas are in `FUTURE.md`; the package README is the only text that ships. Read both before the first edit.

Tooling: Vite library mode (ESM only, `react` and `react/jsx-runtime` external), ESLint, Vitest browser mode with Playwright (jsdom has no Web Animations API), a Vite `playground/` with one card per behaviour. Distribution: private GitHub repo and a git dependency pinned to a tag; consumers upgrade deliberately. `react-animated-select` keeps its own copy and must not depend on this package.

## Project

- `@l1nway/collapse` is a tiny zero-dependency React package with exactly two exports: `Collapse` (animates a block in and out by height or width) and `Presence` (keeps leaving children mounted until their exit finishes). No provider, no config component. It replaces the copy-pasted variants in the owner's projects.
- Treat every change as a change to a reusable module used by many projects, not to an app. A fix for one consumer is a break for another until proven otherwise (see the SYNC rule in `FUTURE.md`).
- The public API is small and stable on purpose. A new prop exists only when two or more consumers need it; one consumer's need stays a wrapper in that consumer.
- Never edit the source projects the copies came from. Never make `react-animated-select` depend on this package (it keeps its own copy).

## Workflow

- Iterate: one feature, one merged copy or one fix per step. No big-bang rewrites.
- Analysis before code for anything larger than a local fix: describe the problem and the plan, then implement once the user has seen it.
- Every step ends green: `eslint`, the browser tests and the build pass. Run the playground card of the changed behaviour by eye when the change is visual.
- Every behaviour change gets a test first or in the same step, and a playground card. A bug found later gets a regression test before the fix.
- A public API change updates `index.d.ts`, the README props table, the changelog and the tests in the same edit.
- Hand off to the user what needs their action (publishing, tagging, migrating a project) as a short numbered list; do not do outward-facing steps (push, tag, publish) without being asked.

## Library constraints

- JavaScript only (`.js`/`.jsx`) plus a hand-written `index.d.ts`. React 19.2+ peer, ESM only, zero runtime dependencies. Never add a dependency, not even a tiny one.
- SSR-safe: touch `window`, `document`, `matchMedia`, `el.animate` or layout only inside effects and handlers, never at module scope or during render.
- Every module-level call carries `/* @__PURE__ */` (`createContext`, `memo`, …). Nothing runs at module scope apart from pure definitions. `"sideEffects": false` must stay true.
- Animations keep animating the real `width` / `height` and the box around it (padding, border, margins). Replacing them with a negative margin, `clip-path` or `transform` was rejected: cheaper, but it looks cheap. Transforms are for purely visual effects.
- No permanent CSS and no CSS file: the component styles an element only while it animates, and restores it afterwards. The package ships no stylesheet, so there is nothing to import, override or lose in a bundler.
- `duration` and `easing` come from props, else from the `DURATION` / `EASING` constants in `collapse.jsx`. Never hardcode a duration or an easing elsewhere.
- Honour `prefers-reduced-motion` and a missing `el.animate`: the state still changes, the callbacks still fire, nothing hangs.
- Size is a first-class concern: the whole package stays small, tree-shakable per export, and every release reports min + gzip per export. A size regression needs a reason.
- The component adds no markup of its own besides the element it renders (`as`), and forwards every other prop to it. It sets no ARIA roles or labels: that is the consumer's content.

## Code style

- As short, compact and declarative as possible. No layers, wrappers or abstractions that do not pay for themselves.
- Match the existing format: 4-space indent, no semicolons, single quotes (in JSX attributes too), `<Tag/>` with no space before `/>`.
- No spaces inside braces: `{variable}`, `{a, b}`, `import {x} from`. Never `{ variable }`.
- No ladders: keep props, params and destructuring on one line while it stays readable (about 120 characters).

```jsx
export function Collapse({as = 'div', axis = 'y', fade = false, in: inProp, group, ...rest}) {
```

- One-line effects stay on one line: `useEffect(() => {fetchData()}, [id])`.
- No copy-paste: repeated code becomes data plus one loop, or one small helper. Two near-identical branches become one branch driven by a value. Shared values are named module-level constants (`AXES`, `LIMITS`).
- Pick the shortest correct form. Search the repo for an existing helper before writing a new one; no duplicate helpers.
- Use `useLayoutEffect` for synchronous DOM work before paint (measuring, starting an animation); `useEffect` for everything else.
- When editing a file, refactor it toward these rules in the same step, with behaviour unchanged and verified by the tests.

## State

- More than 3 state fields → `useReducer` with one merge reducer, declared once. Never re-declare it locally.
- `setState({a, b})` merges a partial. Pass an updater only when the next value reads the previous one, so callbacks stay free of state dependencies.
- A patch that changes nothing returns the same state, so React bails out.
- Validate before dispatch, never inside the reducer. The reducer stays synchronous.
- State holds what the logic needs to remember (present or leaving, pending), never a copy of props or of a constant. Values that change on every frame live in refs, not state.

## Re-renders

- Hooks and contexts return stable references from the start: functions via `useCallback` (or `useEffectEvent` for handlers read by effects), objects via `useMemo`. Refs, `dispatch` and setters are already stable: leave them out of deps. A memoized hook built on an unstable one is unstable; check the whole chain.
- The context value of `Presence` children is memoized; a consumer that does not read it must not re-render when it changes. Read the narrowest context that is enough.
- A component rendered per item is wrapped in `memo` where it pays. No closures created inside `.map()` for memoized children.
- Inline literals from the consumer (`style={{...}}`, `group`) are new every render: do not put them into effect deps by identity.
- Every `setTimeout`, `setInterval`, listener and `Animation` is stored and cancelled on unmount and before re-arming. An interrupted animation never leaves inline styles behind.

## Files

- Hard limit: 200 lines per file (210 tolerated, never more). Past that, split.
- No half-empty files: a file of ~20–70 lines exists only with a real reason (the package entry `index.js`, breaking an import cycle). Otherwise merge it into the cohesive neighbour; keep the file count low.
- Keep helpers, constants and sub-components in the file of their only consumer.
- Any file-structure proposal lists the approximate line count of every resulting file.
- No barrel files except the package entry `index.js` (pure re-exports). Relative imports only.

## Comments & docs

- **Allowed in code:** doc-keys `// [DOC: kebab-key]`, tags of at most 5 lowercase English words that name a line or group without explaining it (`// stale guard`, `// leavers follow neighbour`), and `/* @__PURE__ */`.
- **Not allowed in code:** any explanation of *why*, invariants, bug notes, history, JSDoc, commented-out code. These go into `docs/README.md` under a `## Kebab Key` heading that matches the doc-key.
- Doc sections are short and written for a reader who has not seen the code for weeks: what, invariant, why, gotchas, rejected approaches and why.
- Keep it in sync: a change to behaviour, structure or the API updates its section and doc-keys in the same edit. A stale section found anywhere is fixed on sight. Write down every nuance another agent could trip on (a browser quirk, a tuned value and why, an ordering trap) as soon as you learn it.
- No docs for self-explanatory files. The package README (install, API table, the SYNC rule) is the only text that ships.

## Accessibility & motion

- Respect `prefers-reduced-motion`, both on first render and when the preference changes while mounted.
- Hidden content must not stay reachable: a collapsed element that stays mounted (`unmountOnExit={false}`) is the consumer's to hide from assistive tech; document it in the README and give an example.
- Keyboard and focus: an exiting element keeps its focus and its DOM until it is gone; never move focus on the consumer's behalf.

## Layout stability

- Animations never shift surrounding layout unexpectedly: measure in `useLayoutEffect`, before paint, and start the animation from the measured box.
- Interrupting an animation (reverse, restart, a sibling's reflow) continues from the current visual size, with no jump.
- Check enter, exit, reverse mid-way, a group of siblings and `axis='x'` in the playground at desktop and 390 px.

## Context & token policy

- Never read `node_modules/`, `dist/` or lock files.
- Read only the files the task needs, and do not dump whole files into replies.
- Refactor anti-patterns carefully: functionality first, then style. An easy clear fix is made, gradually, checking behaviour after each step. A large one is proposed first, with an estimate of whether it is worth it. Never break functionality for the sake of style.
