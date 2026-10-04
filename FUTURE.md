# Future

Open requests from consumer projects (the SYNC rule in `README.md`) and ideas that are not built yet.

## SYNC entries

Format:

```
## YYYY-MM-DD <short title>
- Type: bug | feature | api | docs
- Found in: <project / file>
- Problem or wish: <what happens, how to reproduce>
- Impact on other projects: <who may be affected, breaking or not>
- Proposed change: <one or two lines>
- Status: open
```

A library session applies all `open` entries together: semver bump (bug fix = patch, backward-compatible feature = minor, anything that can change existing behaviour = major), tests, types, README and changelog in the same edit, then `Status: done (vX.Y.Z)`. Judge every change against all consumers, not the one that reported it: a fix for one project is a break for another until proven otherwise, so default to an opt-in prop.

### 2026-10-04 Expand from a clamped size
- Type: feature
- Found in: shelf-sharing-webapp / src/app/components/height.js
- Problem or wish: a description clamped to 3 lines (`-webkit-line-clamp`, whatever the length the server sends) with a "… more" toggle expands to its full height, and the toggle fades out smoothly. Text shorter than 3 lines needs nothing. Collapse only knows 0 as the collapsed size (0 ↔ full), while here the closed state is "3 lines" ↔ full, so `Height` stays a CSS-transition copy. What is wrong with it:
  - Text layout jumps. In Shelf the text wraps around a `float: left` avatar. The clamped box (`display: -webkit-box` / `overflow: hidden`) is a new block formatting context, so it sits as a narrow column beside the float; on expand the clamp and `overflow` are dropped at once, the text re-wraps under the avatar in one frame while only the height animates.
  - Text shows over the block below. `overflow` is `visible` during the transition (hidden only while clamped), so the new lines paint over the next block until the height catches up.
  - The "… more" pseudo-element disappears abruptly, not with the expansion.
  - Bugs: inline height left behind when `transitionend` never fires, listener not removed on unmount, overflow (is there anything to expand) measured once and never re-measured on resize.
  - Clamp is a discrete property: it cannot be animated, so it must be switched at the right moment (off before the open size is measured, on after the close finishes), otherwise the closed frame is wrong or the ellipsis flashes.
- Traps for the design: `overflow: hidden` on the clip box also creates a BFC and breaks wrapping around the float for the whole animation (to verify: `overflow: clip` clips without a BFC); the closed size must be min(3 lines, natural height), or a 1-line text would grow to 3; the consumer's own `max-height` or `line-clamp` cannot be the closed size, `LIMITS` lifts them in every frame.
- Impact on other projects: none; opt-in only, backward compatible (minor bump).
- Proposed change: decided with the user, see "Decision" below.
- Status: done (v0.8.1, release pending). Library side only; step 5 (Shelf) is open.
- Deviations from the decision, see `docs/README.md` (Collapse Plugins, Clamp): the closed rest is `max-height: Nlh; overflow: clip` instead of `-webkit-box` + `-webkit-line-clamp` (agreed with the user on 2026-10-04: `-webkit-box` is always a BFC); hooks are `closed`, `frame`, `observe`, `unmountOnExit` (no `prepare` / `done` / `frames`); no `data-open` and no CSS variables (the consumer sets its own `data-open`); no `@l1nway/collapse/clamp` subpath (the root export tree-shakes); `feather` not built.

#### Decision (agreed with the user, implemented in 0.8.1 with the deviations above)

Goal: `<Collapse as='p' plugins={[clamp]} in={open}>` replaces Shelf's `Height` and everything works with no extra setup. Existing behaviour of `Collapse` stays byte-for-byte the same without `plugins` (minor bump, opt-in).

1. **Plugin mechanism in the core.**
   - New prop `plugins?: Plugin[]`, default a module-level empty array. Consumers must pass a stable array (module constant or `useMemo`); the layout effect depends on it. Document that.
   - A plugin is a plain object with optional hooks, so the core pays only for the calls: `{name, prepare(el, ctx), closed(el, ctx), frames(frames, ctx), done(el, ctx), observe(el, ctx)}`. Exact signatures are decided when coding; the contract is: `prepare` runs before measuring (may change styles, returns a restore function), `closed` returns the closed-state overrides (sizes, `overflow`, extra props) instead of the hard-coded zeros, `frames` may edit or add frames, `done` runs after `finish` (enter and exit), `observe` may report state to the consumer (see 3).
   - The core keeps one code path: with no plugins the hooks are no-ops, so the current frames are unchanged. Existing tests must pass untouched.
   - Plugins are tree-shakeable: the core never imports one, `package.json` keeps `"sideEffects": false`, and plugins ship as separate named exports (`import {Collapse, clamp} from '@l1nway/collapse'` must drop `clamp` code when unused; also expose a subpath `@l1nway/collapse/clamp` and check the bundle size of a build that does not use it).
   - The `as` prop already exists (`as: Tag = 'div'`); the work is only to check that it passes through for `p` and other tags with plugins, and to add that case to the tests and the README.

2. **`clamp` plugin (first plugin).** A ready object, default 3 lines, plus a factory for other values (`createClamp({lines})`); the same object works for any element. It owns the whole scenario so Shelf needs no extra CSS or code:
   - Closed state: applies `display: -webkit-box`, `-webkit-box-orient: vertical`, `-webkit-line-clamp: lines` itself (no consumer CSS), and measures the clamped height. The closed size is `min(clamped, natural)`: text of 1 line must not grow, and when natural fits in `lines` no animation size change and no overflow flag.
   - Enter: before measuring the open size it removes the clamp (discrete property), measures, then animates from the clamped height to the full height.
   - Exit: animates full to clamped, and only on `done` puts the clamp back, so the ellipsis appears at the end and never flashes.
   - Clip without breaking the float: during the animation use `overflow: clip` (not `hidden`) so the text keeps wrapping around a `float: left` sibling with no BFC. Verify in a browser (Chromium, Firefox, Safari) first; where `overflow: clip` is unsupported, fall back to `hidden` and document the loss of wrapping. The clamped resting state also must not create a BFC if it can be avoided; if `-webkit-box` forces one, record that limit in the README and keep the animation itself float-safe.
   - Text must not show over the block below: the clip is on for the whole animation (frames carry `overflow: clip`), which also fixes the "text over the next block" bug.
   - Re-wrap on resize: `ResizeObserver` (created in `observe`, disconnected on unmount) re-measures overflow, and the closed size, when the width changes while closed. Replaces Shelf's one-time measurement.
   - Overflow flag: the plugin sets `data-overflow` (`true` / absent) and `data-open` on the element, so a consumer styles the "… more" pseudo-element with plain CSS (`[data-overflow]:not([data-open])::after`). It also exposes the same value through an optional callback prop on the plugin factory (`onOverflow`) for consumers that render a real button. When there is nothing to expand, `in` is a no-op and no animation runs.
   - "… more" fade: the pseudo-element is the consumer's. `data-open` flips at the start of the animation, so the consumer's CSS transition on `opacity` runs in step with the height (`transition: opacity var(--collapse-duration)`). The plugin exposes `--collapse-duration` and the easing as CSS variables on the element for that reason.
   - Optional soft edge (`feather`, off by default): a `mask-image` linear gradient on the bottom edge while animating, removed at the end. Keep it behind the option; decide whether it makes the first release by its bundle cost.
   - Reduced motion: honour the core's existing handling (duration 0), the clamp state still switches correctly.
   - Interplay: works with `in` and under `Presence` like the rest (`byPresence`); `unmountOnExit` defaults to `false` when a `clamp` plugin is present (the element never leaves, it only changes size), and the core must accept a plugin changing that default.
   - Accessibility is left to the consumer, but document the pattern: the element or a real button gets `aria-expanded`, `role='button'` only when `data-overflow` is set.

3. **Not in the library.**
   - Typewriter text reveal: Shelf side only. The children are server-rendered `Hashtags`, so splitting text into spans conflicts with them; if wanted, do it with a CSS mask reveal, not by rewriting the children.
   - The "… more" label text and its look.

4. **Tests, types, docs.** Tests: core without plugins unchanged; plugin hook order; clamp short text (no growth, no flag); clamp long text (open, close, ellipsis returns only at the end); resize while closed; reverse mid-animation; reduced motion; stable `plugins` requirement; `as='p'`. Types: `Plugin` type and the `plugins` prop in `index.d.ts`, `clamp` / `createClamp` declarations. README: a "Plugins" chapter with the contract and a Shelf-style example; `[DOC: ...]` keys for the new code per the library's own conventions; changelog entry; minor version bump.

5. **After the library release (Shelf side, separate session).** Add the dependency (the user's approval is needed, as for any dependency), replace `Height` in `collection/[id]/page.js` and `item/[id]/page.js` with `<Collapse as='p' plugins={CLAMP} in={open} data-open={open || undefined}>` (`CLAMP` a module constant) plus the "… more" CSS from the package README, drop the old `transition: height` rule, delete `height.js` / `height.css`, update `components/README.md` ("Height expand") and CLAUDE.md "How the project works" (shared pieces list), then verify in a browser and with Lighthouse.

## Ideas

### A third component: appear from nowhere
- Working name: `Fade` (or similar). Not started, no consumer asks for it yet.
- What: an element that appears and disappears in place, with no size change: opacity, optionally a small scale or translate. No layout shift at all, so it needs none of the layout rules `Collapse` has.
- Why: today `Collapse` with `fade` is the only way to get a fade, and it always changes the size. Overlays, tooltips and badges want the opposite.
- Shape to consider: same contract as `Collapse` (`in`, `as`, `unmountOnExit`, `duration`, `easing`, `ref`, `onEntered` / `onExited`, works under `Presence`), animated with `el.animate`, no permanent CSS, reduced motion honoured.
- Transforms are allowed here: the rule against them applies to size animation only.
- Open: a separate export or a mode of `Collapse`; the size budget per export decides.
