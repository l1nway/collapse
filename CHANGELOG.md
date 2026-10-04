# Changelog

## Why this package exists

The same height and width animations were needed in many projects. Each project hit its own problems with them, fixed them locally, and the fixes never travelled: the copies drifted apart. Some projects pulled in an animation library for it, some had a low-quality hand-rolled version, some had a good one that the others never got.

`@l1nway/collapse` is the end of that: one small tested component, fixed once, used everywhere. A bug or a wish found in any project goes to `FUTURE.md` and is resolved here for all consumers at once, instead of becoming one more diverging copy.

## 0.8.1

- `plugins` prop on `Collapse`: plain objects with optional `closed(el, on)`, `frame`, `observe(el)` and an `unmountOnExit` default. Without plugins nothing changes.
- `clamp` / `createClamp({lines, onOverflow})`: a block that rests at N lines (default 3) and expands to its full height. Wraps around floats the whole time (`overflow: clip`, no formatting context), flags `data-overflow`, and re-measures it when the element resizes or its text changes (ResizeObserver + MutationObserver). While closed it shows the live children. Replaces Shelf's `Height`.
- Size: `Collapse` 3241 B min / 1682 B gzip (+418 / +195 for the plugin hooks); `clamp` 811 / 491, dropped when unused.
- CI: the workflow installs all three browsers the tests run in (chromium, firefox, webkit). Before, only chromium was installed and `npm run check` failed on the missing Firefox. Browser test files now run one at a time: with three browsers in parallel a Firefox session sometimes never connected and failed the run.

## 0.8.0

First release as a package. It starts at 0.8.0 because it continues the `Collapse` of `react-animated-select` 0.7.x, which was the most complete of the copies. Exports `Collapse` and `Presence`.
