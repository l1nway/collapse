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
- Problem or wish: a description clamped to 3 lines (`-webkit-line-clamp`) with a "… more" toggle expands to its full height. Collapse only knows 0 as the collapsed size, so `Height` stays a CSS-transition copy with its own bugs (inline height left behind when `transitionend` never fires, listener not removed on unmount, overflow measured once).
- Impact on other projects: none until designed; a new opt-in prop or a wrapper, not breaking.
- Proposed change: decide during the shelf migration: a generic "collapsed size" for Collapse, or a shelf-side wrapper on top of it.
- Status: open

## Ideas

### A third component: appear from nowhere
- Working name: `Fade` (or similar). Not started, no consumer asks for it yet.
- What: an element that appears and disappears in place, with no size change: opacity, optionally a small scale or translate. No layout shift at all, so it needs none of the layout rules `Collapse` has.
- Why: today `Collapse` with `fade` is the only way to get a fade, and it always changes the size. Overlays, tooltips and badges want the opposite.
- Shape to consider: same contract as `Collapse` (`in`, `as`, `unmountOnExit`, `duration`, `easing`, `ref`, `onEntered` / `onExited`, works under `Presence`), animated with `el.animate`, no permanent CSS, reduced motion honoured.
- Transforms are allowed here: the rule against them applies to size animation only.
- Open: a separate export or a mode of `Collapse`; the size budget per export decides.
