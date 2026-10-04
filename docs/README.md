# Internals

Rationale behind the doc-keys in `src/`. The public contract is in the root `README.md`.

## Testing

- Real browsers only (Vitest browser mode + Playwright: chromium, firefox, webkit); jsdom has no Web Animations API. `*.browser.test.jsx` run in browsers, `*.node.test.js(x)` in node (SSR, package shape).
- Drive animations by `animation.currentTime` / `finish()`, with `easing='linear'` and a long `duration` for value checks; no sleeps. The `finish` event lands on the next animation frame: `finish(el)` / `settle()` in `test/helpers.jsx`.
- WebKit lets real frames pass inside `await act(...)`: a running animation moves by a frame or two. Assert "no jump" synchronously right after the update, before awaiting, or pause the animation first.
- `playbackRate` after `reverse()` still reads the old value until the pending rate applies: `await animation.ready` first.
- A `MutationObserver` changes what it observes: it forces Chromium/WebKit to serialize the inline style (see Collapse Measure). Collect its records in the callback; `takeRecords()` after an `await` is empty.
- Several runs in parallel need distinct ports: `--api.port=<n>`.
- Do not `pause()` an animation before toggling to test a reverse: a paused animation is not `running`, so the core cancels it and starts a new one from the measured size.
- Known flakes, present before plugins too: "Failed to connect to the browser session … [browser (firefox)]" now and then on a full `npm test` (all tests still pass), and the WebKit reverse tests in `collapse.core` under heavy load (real time runs the 400 ms reverse out before `settle()` returns).

## Build Jsx

- `vite.config.js` builds the library without `@vitejs/plugin-react` and pins the oxc JSX transform to `{runtime: 'automatic', development: false}` (`jsx`, also used by `scripts/size.js`). The plugin is only for tests and the playground.
- Why: the plugin picks the dev JSX runtime whenever `NODE_ENV` is not `production`, and Vite does not override an already set `NODE_ENV`. A build under `NODE_ENV=test` (a test runner, some CI) shipped `import … from 'react/jsx-dev-runtime'`, which breaks consumers' production builds.
- Regression: `test/package.node.test.js` builds under `NODE_ENV=test` and allows only `react` / `react/jsx-runtime` imports.

## Collapse

`src/collapse.jsx`, `Collapse`: renders one element (`as`, default `div`) and animates its whole box on one axis when it opens and closes. Runs on the Web Animations API (`element.animate`), no dependencies, no stylesheet.

- Origin: the `Collapse` of `react-animated-select` (`src/motion.jsx`, sandbox version with the hold and deps fixes), minus `group`, `nodeRef` and the Select config context; plus frozen children (from the demo's `SlideDown`) and the `ref` fix.
- Shown state: `in` (any value, coerced with `!!`). Without `in` it follows the nearest `Presence`; without either it is hidden.
- `duration` / `easing`: prop, else `DURATION` (300) / `EASING` (`'ease'`). There is no provider for defaults: a project that wants other defaults wraps `Collapse` once.

## Collapse Frames

- Collapsed frame: every property of `AXES[axis]` is `0px` (size, both margins, both paddings, both border widths), plus `opacity: 0` with `fade`. A styled element can be the Collapse itself, no wrapper needed.
- With a border, a middle frame is added (see Collapse Edge).
- Every frame carries `overflow: hidden`, `text-overflow: clip`, `box-sizing: border-box` (see Collapse Border Box), the lifted limits of the axis and, last, every plugin's `frame` (see Collapse Plugins) (`LIMITS`: `min-*: 0`, `max-* : none`). While it animates, the animation owns the size. The measured target already includes the element's own limits. Without the lift a consumer `min-height` stops a collapse halfway, and an ellipsis slides with a growing line.
- Fill: an opening animation uses `fill: 'backwards'`, a closing one `fill: 'both'`. Every animation that ends open leaves no trace (it is also cancelled in `finish`), every one that ends closed holds 0 until unmount or reopen. The close fill also covers the before phase: Chrome may resolve the start time a little after the current frame, and with `forwards` only the element would flash its natural size for that instant.
- When an open finishes, the animation is cancelled: a reversed close keeps `fill: 'both'`, and its backwards fill would otherwise hold the measured size and the clip, clipping later content growth.

## Collapse Measure

- `measure()` reads one frame; it runs once for the open frame and, with a plugin `closed`, once more for the closed frame (see Collapse Plugins).
- The target is read with `getComputedStyle` under a temporary inline `overflow` equal to the frames' one (`hidden`, or a plugin's `clip`), restored in the same task. That is the box the animation renders: the clipped element is a block formatting context and contains the first / last child margins. At rest those margins collapse through the element and are not part of its `height`. Measured without the clip, the open ended short by the margin and the margin popped out when the clip went (seen as a 16 px jump in the demo's Styling panel).
- Limit: a collapsed-through margin that also merges with a margin outside the element (the next sibling's `margin-top`) still moves by the merged part.
- Order: nested animations are seeked first, then the rest box is read (`getBoundingClientRect().bottom`, no clip, for Collapse Margin Shift), then the clip is set and the computed values and the clipped box are read. Two forced layouts per transition.
- Measured once per transition. Content that changes size mid-animation snaps at the end; changes while open are natural layout.
- Rejected: permanent `display: flow-root` (an inline `display` overrides a consumer class such as `display: grid`); negative margins, `clip-path`, `transform` (cheaper, looks cheap; see `CLAUDE.md`).

- An empty `style` attribute left by the measurement (the element had no inline style) is removed (`tidy`, also used by `clamp`), so the element ends exactly as the consumer rendered it.
- Trap: the check must read `el.getAttribute('style')`, not `el.style.length`. Chromium and WebKit serialize the inline style into the attribute lazily: after `removeAttribute('style')` on a still-dirty declaration, the next read re-serializes it as `''`. Reading the attribute first forces the sync. A `MutationObserver` on the element also forces it, which hides the bug in a traced test.

## Collapse Border Box

- The size frame is the border-box size (`size` + both paddings + both border widths, or the computed size as is when the element already is `border-box`), and both frames set `box-sizing: border-box`.
- Why: browsers snap a used border width to device pixels, rounding down (any width under 1 device px rounds up to 1). An interpolated `2.97px` border paints and lays out as `2px`. In `content-box` the box lagged by up to 1 device px per border for the whole animation, and with `ease` the slow tail made it visible: a 1–2 px jump of the box and everything below at the end of an open and at the start of a close (seen in Firefox at 2000 ms; measured the same in Chromium and WebKit). In `border-box` the snap only moves the content inside the clip by a sub-pixel; the outer box follows the timing exactly.
- Near size 0 each non-zero border is at least 1 device px, which `border-box` cannot absorb: see Collapse Edge.
- Children see the same content box as at rest, so percentage sizes inside do not change.

## Collapse Edge

- With a non-zero border on the axis, a third keyframe sits between closed and open at the point where the size is `EDGE` (3 px): paddings and borders are `0px` there, the size, margins and opacity are the open values scaled by `k = EDGE / open size` (offset `k` on open, `1 - k` on close). Below it the box is a plain background strip; above it paddings and borders grow from 0 to their open values.
- Why: a border under 1 device px still paints and lays out as 1 device px, and in `border-box` the box cannot be smaller than its paddings plus borders. Without the frame the first instant of an open and the last of a close showed a strip of 2 device px plus paddings that then vanished at once (about 2 px at 2000 ms in Firefox, the same in Chromium and WebKit).
- Paddings go to 0 with the borders so that just above the frame the 3 px size always fits the snapped borders (2 device px, up to DPR 0.67) plus the paddings; with paddings scaled linearly a box of mostly padding would still grow.
- The size, margins and opacity stay linear in the eased progress (keyframe offsets are in the eased progress, `easing` is on the effect), so the box and the layout around it move exactly as with two frames. Only the content inside the clip moves on a kink at 3 px.
- No border, an open size of 3 px or less, or a plugin `closed` (the closed box is not 0 and keeps its paddings): two frames, as before. Without a border the frame would only zero the paddings, there is nothing to fix.
- The value is computed by scaling the number in each computed open value (`replace`), so margins keep their sign and the margin shift.

## Collapse Margin Shift

- Axis `y` only (horizontal margins never collapse). The clip makes the element a block formatting context, so a last child's `margin-bottom` that collapses through the element at rest sits inside it while it animates and gets painted with the element's background; the background then snapped back when the clip went (seen in the playground's Child margins card).
- Fix: `shift` = clipped box bottom − rest box bottom. The open frame takes `shift` off the size and adds it to `margin-bottom`, so the box ends where the rest box ends and the layout below is the same as before. The clipped overflow is that empty margin. Scaled by `full / height` so an ancestor `transform: scale` does not distort it. A negative child margin gives a negative shift and works the same way.
- Limit, top side: the first child's collapsed-through `margin-top` cannot be moved out the same way, because inside the clip it pushes the content down; it stays painted with the background while animating. Documented in the package README with the workaround (padding instead of margin).
- Rejected: `overflow: clip` instead of `hidden` (no formatting context, so no margins inside): the closed frame has no padding or border, so child margins would collapse through it and leave a gap at size 0, and an element with a border would start collapsing margins mid-animation.

## Collapse Nested

- Problem: an outer and an inner Collapse open in the same commit. React runs the inner layout effect first, so the inner already holds its closed frame (`fill: 'backwards'`) when the outer measures: the outer animated to its size without the inner content and jumped by that amount at the end (100 → 200 px in the test).
- Fix: when opening, the outer moves every running Collapse animation in its subtree to its final point (`endTime`, or 0 for a reversed one), measures, and puts each `currentTime` back, all in the same task, so nothing is painted in between. An opening inner contributes its natural size, a closing one 0, a held one 0.
- Only the package's own animations are touched: each one is created with `id: ID` (`'collapse'`). Consumer CSS animations and transitions are never seeked (an infinite one has no end).
- Only on enter. On exit the outer starts from what is on screen, and a final-state measure would make it jump at the start.
- Seeking past the end does not fire `finish`: the finish notification is queued as a microtask and aborts because the animation is running again by then.
- Limit: an inner Collapse that starts after the outer has started still snaps the outer at its end (measured once per transition).

## Collapse Reverse

- Toggling while an animation runs calls `animation.reverse()`: it plays back from the current point over the time already run. No jump, no new measurement. The finish handler reads the latest shown state (`useEffectEvent`), so a reversed close ends open and is cancelled, a reversed open ends closed and unmounts.
- A reversed open keeps `fill: 'backwards'`. Played backwards and finished at time 0, the effect is in its before phase, so the fill holds the closed frame until unmount.
- `onfinish` is the only completion signal: no timers, no `transitionend`. A stale animation is ignored by `anim.current === animation`.

## Collapse Hold

- Hidden and unchanged (mount hidden with `unmountOnExit={false}`, or the element appeared later): a zero-length `[closed, closed]` animation with `fill: 'forwards'` holds the element at 0 without animating.
- The hold is set whenever the current animation does not target the current element. A ref is not a dependency, so the effect re-runs on `mounted` and `as`: an element rendered later (`unmountOnExit` turned `false` while hidden, or another tag) gets its own hold instead of rendering at full size, and an element rendered again does not rely on the old element's hold.
- With a plugin `closed` there is no hold: `closed(el, true)` puts the element in its closed rest instead (see Collapse Plugins).
- Hidden at rest and `unmountOnExit` turns `true`: an element that never opened unmounts; one that closed while `unmountOnExit` was `false` stays mounted, held at 0, until its next close.

## Collapse Frozen

- While leaving (and while hidden but mounted) the element renders `kept`: the last children it got while shown. A panel whose content depends on the state that hides it (a list that became empty) does not flash its empty state while it collapses. framer's `AnimatePresence` behaves the same way, and the demo's Safety panel relies on it. Exception: when a plugin owns the closed rest (`closed` hook) the closed element is visible content, so it always renders the live `children` (a clamped description must follow its text); the no-flash guard does not apply to it.
- `kept` is state adjusted during render (React's "store information from previous renders" pattern). While shown, a new `children` identity (every parent render) re-runs the component function once before its children render; the subtree is not rendered twice. A ref written in an effect would avoid the re-run but reads a ref during render, which React and its lint rules reject.
- Gotcha: a consumer that wants live content during the exit must keep it in the shown state (for example close with `in` and change the content after `onExited`).

## Collapse Ref

- `ref` (React 19 ref-as-prop) receives the rendered element: for reading its size, focusing it, observing it. The element gets one merged callback ref (`attach`) that fills the internal `node` and forwards to the consumer ref (object or callback), so a consumer ref never replaces the one the animation uses. Before, `ref` landed in `...rest`, overrode the internal ref, and nothing animated.
- `attach` always returns a cleanup: it clears `node` and calls the consumer's own cleanup if its callback returned one, else sets the consumer ref to `null`. Returning the consumer's cleanup alone would leave `node` pointing at a detached element.
- A new element (remount after exit, another `as`) is attached before the layout effects run, so the effect always sees the current element.
- An inline callback ref (a new function every render) is detached and attached again on every commit, as in plain React.
- Rejected: `useImperativeHandle(ref, () => node.current, [mounted, Tag])`; the deps are not read by the callback, so they are a lint violation and fragile.
- The consumer must not write inline styles that the animation owns (`overflow`, the axis sizes) while it runs.

## Collapse Reduced Motion

- `prefers-reduced-motion: reduce` is read when an animation starts and sets its duration to 0. The state still changes through the same path: hold at 0, `onEntered` / `onExited` and `Presence` removal all happen, without motion. A running animation keeps its duration if the setting flips mid-way; the next one follows the new setting.
- Without `element.animate` (jsdom in consumer tests) every change completes at once and the callbacks still fire. `window.matchMedia` is optional-chained for the same reason.

## Collapse Reconnect

- React disconnects and reconnects the effects of a mounted component in StrictMode and inside `<Activity>`. The disconnect does not reset the last shown marker, so a reconnect finds the state unchanged and a running animation just continues.
- The cleanup clears `alive` and, one microtask later, cancels the animation only if the component did not reconnect (a real unmount, or a hidden `<Activity>`). StrictMode reconnects synchronously in the same commit, so its animation survives. After an `<Activity>` reveal the hold is set again (its target check fails because `anim.current` was cleared).
- `alive` keeps a finish that lands after a real unmount from calling back.
- Rejected: cancelling synchronously on cleanup; every StrictMode remount lost its animation and snapped to full size.

## Collapse Plugins

- `plugins` (default `NONE`, a module-level empty array) is a list of plain objects. Every member is optional; the core never imports a plugin, so an unused one is tree-shaken.
  - `unmountOnExit: false` changes the default of the prop (an explicit prop still wins).
  - `frame`: styles merged last into every keyframe, also the `overflow` the measurement uses.
  - `closed(el, on)`: applies (`true`) or removes (`false`) the element's closed rest state. Its presence (`owned`) changes the closed side: the closed frame is `measure()` under that state instead of zeros, no edge frame, no hold. Order per change of `in`: `closed(false)` (before the reverse check, so even a no-animation environment ends open), measure open, `closed(true)`, measure closed, `closed(false)`, animate. At the end of a close: `closed(true)`, then the animation is cancelled in the same task, so the rest state takes over from the fill with no frame in between.
  - `observe(el)`: called from the ref callback when the element attaches; its return value is called when it detaches.
- With `owned`, a closed box equal to the open one (nothing to expand) switches at once: no animation, the callbacks fire.
- Without plugins every hook is a call over an empty array: the frames and the timing are the ones the existing tests pin.
- Stability: `plugins` is an effect and ref dependency. A new array every render re-runs the hold branch (`closed(true)` again, idempotent) and re-attaches the ref (`observe` restarts); correct, but wasted work. Consumers pass a module constant or `useMemo`.
- Rejected from the agreed plan: a `start` hook that sets `data-open` and `--collapse-duration` / easing CSS variables (the consumer already has `open` and the duration it passed: one attribute on its side, rendered on the server too); a `@l1nway/collapse/clamp` subpath (the root export already tree-shakes, checked in `package.node.test.js`; a subpath needs a second entry, a shared chunk and a second `d.ts`).
- Cost: `Collapse` +418 B min / +195 B gzip for the hooks (0.8.0: 2823 / 1487).

## Clamp

`src/clamp.js`, `createClamp({lines = 3, onOverflow})` and the default `clamp`: a block (a description, a `p`) that rests at `lines` lines and expands to its full height.

- Closed rest: inline `max-height: <lines>lh; overflow: clip`. The closed frame is that box measured, so it is `min(lines, natural)` by itself: a 1-line text never grows, and a text that fits switches without motion.
- No block formatting context anywhere: `overflow: clip` (the frames carry it too) clips without one, so text wraps around a `float` sibling the same way at rest, while animating and open. With a BFC the box would sit beside the float as a narrow column and the lines would re-wrap at the start and end of every animation (the Shelf bug).
- Rejected: `display: -webkit-box` + `-webkit-line-clamp` at rest (native `…`, but `-webkit-box` always creates a BFC, see above). The "… more" mark is the consumer's pseudo-element. `overflow: hidden` while animating (BFC, the same re-wrap).
- `lh` needs Chrome 109, Safari 16.4, Firefox 120; every browser with `lh` has `overflow: clip`, so there is no fallback. With `line-height: normal`, `lh` uses the font's normal height; a line with a taller fallback font or inline-block may cut a pixel or show a sliver. Give the element an explicit `line-height`.
- `closed(el, false)` writes `''` to `max-height` and `overflow`: a consumer inline `overflow` / `max-height` on the element is lost. Use a class.
- `unmountOnExit: false`: the element never leaves, it only changes size.
- Server render and first paint are unclamped (the rest state is set in a layout effect). A consumer CSS rule such as `p:not([data-open]) {max-height: 3lh; overflow: clip}` with its own `data-open` gives the clamped first paint.

## Clamp Overflow

- `data-overflow` (present / absent) on the element and `onOverflow(boolean)` when it changes: is there anything to expand. Stored on the element only, so one plugin object serves any number of elements.
- Measured in a `ResizeObserver` callback (the initial one at attach, then on every size change) and a `MutationObserver` one (text or children changed): both heights read by flipping the rest state on and off, then the state put back; same task, nothing painted, and the observed size ends unchanged, so no observer loop.
- Skipped while a Collapse animation (`id` `ID`) is on the element: its frames lift `max-height`, so the flip would read the animated size. A width change during an animation is picked up by the next resize only.
- Why both: closed, the box stays `lines` tall when the text changes between exactly `lines` lines and more, so `ResizeObserver` stays silent and the flag would go stale. The `MutationObserver` (`childList`, `characterData`, `subtree`, no attributes, so the flag and style writes never re-trigger it) covers that; a re-render with identical text mutates nothing and costs nothing.
- Without `ResizeObserver` (jsdom) nothing is observed and the flag stays absent.

## Presence

`src/presence.jsx`, `Presence`: keeps a child mounted after the parent stops rendering it, until that child's exit animation ends. Renders no element.

- Every child needs a stable unique `key`, and contains exactly one `Collapse` without `in`. That Collapse reads the child's state from `PresenceContext` (defined in `collapse.jsx`, so `Collapse` alone never imports `Presence`) and reports the end of its exit. A child without such a Collapse never leaves.
- State: `{children, list}`; `list` holds `{key, el, present, appear, pending?, swap?}` in render order. Re-synced during render when `children` changes ("adjust state while rendering").
- `PresenceChild` provides a memoized `{present, appear, swap, onExited}` per item, so a `memo` child is not re-rendered by its siblings' changes.
- `appear` is `false` for the children of the first render and `true` for later ones; Collapse reads it once, at mount.
- `onExited(key)` drops the item; a no-op if the key became present again (late finish).
- The frozen element is never updated: a leaving child keeps the props it had when removed. Keys come from `Children.toArray` and carry React's `.$` prefix; they are only compared with each other.
- Removed against the Select copy: `hold` (the Select's chip hold, not a general need).

## Presence Order

- A child whose key vanished stays right after its old neighbour (the nearest earlier child that was present and still is), with `present: false`. Anchoring on the neighbour keeps several leavers in order; an index-based splice put a leaver after its right neighbour once another child had left or moved, and React moved DOM nodes.
- Re-adding a key while it leaves flips it back to `present`; its Collapse reverses and it moves to its new place.

## Presence Wait

- `wait`: out, then in. When one change of `children` both drops present keys and adds new ones, the new keys wait (`pending`, rendered as nothing, keeping their place) until no leaver remains. A key added while others wait also waits. A waiting key removed again never mounts. Pure removals and pure additions never wait.
- The leavers of such a change and the keys that waited for them are marked `swap`; their Collapse runs at half the default duration so out plus in takes one duration. An explicit `duration` prop wins. The mark clears at the next change of `children`; a running animation keeps its timing.
- When the last leaver is dropped, `release` turns the waiting items into ordinary ones; they mount with `appear` and animate in. A re-sync that leaves no leaver also clears `pending`, because items are rebuilt from `children`.

## Release

- Consumers install a git tag. A tag commit is a child of `main` that also contains `dist/` (force-added), so the consumer's install needs no build and no devDependencies. `main` itself never holds `dist/`.
- `npm run release -- patch|minor|major|x.y.z` does it all: clean `main`, a `## x.y.z` section in `CHANGELOG.md`, version bump, `npm run check`, bump commit, detached `dist` commit, tag, `git push --atomic origin main vX.Y.Z`. A failed check aborts before any commit or tag, so consumers keep the old version.
- Hooks (`npm run hooks` once per clone): `pre-commit` runs lint and tests, `pre-push` runs the full check. GitHub cannot reject a push; `.github/workflows/check.yml` re-runs the check there.
- Consumers use `npm i github:l1nway/collapse#semver:^0.8.1`: npm picks the highest matching tag, the lockfile pins the commit, `npm update @l1nway/collapse` takes a newer one.
- The `--no-verify` flags in the release script are deliberate: the check has just passed.
