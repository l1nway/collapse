# Changelog

## Why this package exists

The same height and width animations were needed in many projects. Each project hit its own problems with them, fixed them locally, and the fixes never travelled: the copies drifted apart. Some projects pulled in an animation library for it, some had a low-quality hand-rolled version, some had a good one that the others never got.

`@l1nway/collapse` is the end of that: one small tested component, fixed once, used everywhere. A bug or a wish found in any project goes to `FUTURE.md` and is resolved here for all consumers at once, instead of becoming one more diverging copy.

## 0.8.0

First release as a package. It starts at 0.8.0 because it continues the `Collapse` of `react-animated-select` 0.7.x, which was the most complete of the copies. Exports `Collapse` and `Presence`.
