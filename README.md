# @l1nway/collapse

Animate a block in and out by height or width. React 19.2+, zero dependencies, no stylesheet, ESM only.

## Install

```sh
npm i github:l1nway/collapse#semver:^0.8.0
```

## Usage

```jsx
import {Collapse, Presence} from '@l1nway/collapse'

<Collapse in={open}>{content}</Collapse>

<Collapse in={busy} axis='x' fade as='span'><Spinner/></Collapse>

<Presence>
    {items.map(item => <Collapse key={item.id}>{item.label}</Collapse>)}
</Presence>
```

## Collapse

| Prop | Default | Meaning |
|---|---|---|
| `in` | — | Shown when truthy. Omitted: follows the nearest `Presence`; with no `Presence` it is hidden. |
| `axis` | `'y'` | `'y'` animates `height` plus vertical padding, border widths and margins; `'x'` the same horizontally. |
| `fade` | `false` | Also animates `opacity`. |
| `as` | `'div'` | The rendered tag or component. |
| `unmountOnExit` | `true` | Removes the element once closed. `false` keeps it in the DOM, collapsed to 0. |
| `duration` | `300` | Milliseconds. |
| `easing` | `'ease'` | Any CSS easing. |
| `ref` | — | Receives the rendered element (read its size, focus it). `null` while unmounted. |
| `onEntered` / `onExited` | — | Called when the open / close animation finishes. |
| rest | — | Spread onto the element (`className`, `style`, `id`, ARIA, handlers). |

- Mounted shown: no animation. Mounted hidden: nothing rendered (or held at 0 with `unmountOnExit={false}`).
- Toggling mid-way reverses from the current size.
- While leaving, the element keeps rendering the last children it had while shown.
- The element clips its content only while it animates. No class, no permanent inline style.
- `prefers-reduced-motion: reduce` and environments without `element.animate` (jsdom) switch instantly; callbacks still fire.
- A Collapse with a background and no top padding or border: the first child's top margin is painted with that background while it animates. Give the Collapse a `padding-top`, or the child a padding instead of a margin.
- Do not put a CSS `transition` on the animated sides.
- `unmountOnExit={false}`: the collapsed element stays reachable for assistive tech and keyboard. Hide it yourself:

```jsx
<Collapse in={open} unmountOnExit={false} inert={!open} aria-hidden={!open}>{content}</Collapse>
```

## Layout rules (your side)

The library animates the element only. It cannot control the container around it, so these two cases are on you:

- **No `gap` in the container.** CSS `gap` does not animate: it appears or disappears at once and the layout jumps. Put the spacing inside the Collapse (its own padding or margin), which is animated with it.
- **No horizontal Collapse in a container where it is the tallest item.** `axis='x'` keeps its height all the time. If the other items are shorter, the container's height drops abruptly when the element leaves (and grows abruptly when it enters). Give the container a fixed or `min-height`, or make sure the other items are at least as tall.

## Presence

Keeps a removed child mounted until its exit animation ends.

| Prop | Default | Meaning |
|---|---|---|
| `wait` | `false` | When one update both removes and adds children, the new ones wait until the removed ones have left; both run at half duration. |

- Every child needs a stable unique `key` and must contain exactly one `Collapse` without `in`.
- Children of the first render do not animate in; children added later do.
- A leaving child keeps the props it had when it was removed.

## SYNC rule

Found a bug, a missing feature or an API question while working in a consumer project? Do not patch a local copy and do not change this package ad hoc. Append an entry to `FUTURE.md` in this repo and go on. A library session applies the open entries together, judged against every consumer.
