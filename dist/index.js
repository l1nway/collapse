import { Children, createContext, isValidElement, useCallback, useContext, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/collapse.jsx
var AXES = {
	x: [
		"width",
		"marginLeft",
		"marginRight",
		"paddingLeft",
		"paddingRight",
		"borderLeftWidth",
		"borderRightWidth"
	],
	y: [
		"height",
		"marginTop",
		"marginBottom",
		"paddingTop",
		"paddingBottom",
		"borderTopWidth",
		"borderBottomWidth"
	]
};
var STILL = {
	overflow: "hidden",
	textOverflow: "clip",
	boxSizing: "border-box"
};
var LIMITS = {
	x: {
		minWidth: "0px",
		maxWidth: "none"
	},
	y: {
		minHeight: "0px",
		maxHeight: "none"
	}
};
var EDGE = 3;
var DURATION = 300;
var EASING = "ease";
var ID = "collapse";
var NONE = [];
var call = (plugins, hook, ...args) => plugins.map((plugin) => plugin[hook]?.(...args));
var tidy = (el) => {
	if (!el.getAttribute("style")) el.removeAttribute("style");
};
var PresenceContext = /* @__PURE__ */ createContext(null);
function Collapse({ as: Tag = "div", axis = "y", fade = false, in: inProp, plugins = NONE, duration: durationProp, easing = EASING, unmountOnExit = !plugins.some((plugin) => plugin.unmountOnExit === false), ref, onEntered, onExited, children, ...rest }) {
	const owned = plugins.some((plugin) => plugin.closed);
	const presence = useContext(PresenceContext);
	const byPresence = inProp === void 0 && !!presence;
	const shown = byPresence ? presence.present : !!inProp;
	const duration = durationProp ?? DURATION / (byPresence && presence.swap ? 2 : 1);
	const node = useRef(null);
	const anim = useRef(null);
	const alive = useRef(false);
	const [initial] = useState(() => byPresence && presence.appear ? !shown : shown);
	const last = useRef(initial);
	const [gone, setGone] = useState(!shown);
	if (shown && gone) setGone(false);
	const [kept, keep] = useState(children);
	if (shown && kept !== children) keep(children);
	const mounted = !(gone && unmountOnExit);
	const attach = useCallback((el) => {
		const set = (value) => typeof ref === "function" ? ref(value) : ref && (ref.current = value);
		node.current = el;
		const detach = set(el);
		const stops = call(plugins, "observe", el);
		return () => {
			node.current = null;
			stops.forEach((stop) => stop?.());
			if (typeof detach === "function") detach();
			else set(null);
		};
	}, [ref, plugins]);
	const finish = useEffectEvent(() => {
		if (!shown) call(plugins, "closed", node.current, true);
		if (shown || owned) {
			anim.current?.cancel();
			anim.current = null;
		}
		if (shown) {
			onEntered?.();
			return;
		}
		onExited?.();
		if (byPresence) presence.onExited();
		if (unmountOnExit) {
			anim.current = null;
			setGone(true);
		}
	});
	useLayoutEffect(() => {
		const el = node.current;
		if (!el) return;
		const props = fade ? [...AXES[axis], "opacity"] : AXES[axis];
		const still = Object.assign({}, STILL, LIMITS[axis], ...plugins.map((p) => p.frame));
		const zero = {
			...Object.fromEntries(props.map((p) => [p, p === "opacity" ? 0 : "0px"])),
			...still
		};
		const rest = (on) => call(plugins, "closed", el, on);
		if (last.current === shown) {
			if (!shown && owned) rest(true);
			else if (!shown && anim.current?.effect?.target !== el && el.animate) anim.current = el.animate([zero, zero], {
				id: ID,
				fill: "forwards"
			});
			return;
		}
		last.current = shown;
		rest(false);
		const running = anim.current;
		if (running?.playState === "running") {
			running.reverse();
			return;
		}
		running?.cancel();
		if (!el.animate) {
			finish();
			return;
		}
		const nested = shown ? el.getAnimations({ subtree: true }).filter((a) => a.id === "collapse" && a.effect.target !== el) : [];
		const times = nested.map((a) => a.currentTime);
		nested.forEach((a) => {
			a.currentTime = a.playbackRate < 0 ? 0 : a.effect.getComputedTiming().endTime;
		});
		const [size, , end, ...box] = AXES[axis];
		const measure = () => {
			const base = el.getBoundingClientRect().bottom;
			const { overflow } = el.style;
			el.style.overflow = still.overflow;
			const computed = getComputedStyle(el);
			const px = (p) => parseFloat(computed[p]);
			const frame = {
				...Object.fromEntries(props.map((p) => [p, computed[p]])),
				...still
			};
			const full = computed.boxSizing === "border-box" ? px(size) : box.reduce((sum, p) => sum + px(p), px(size));
			const { bottom, height } = el.getBoundingClientRect();
			const shift = axis === "y" && height ? (bottom - base) * full / height : 0;
			frame[size] = full - shift + "px";
			frame[end] = px(end) + shift + "px";
			el.style.overflow = overflow;
			return frame;
		};
		const open = measure();
		rest(true);
		const closed = owned ? measure() : zero;
		rest(false);
		nested.forEach((a, i) => {
			a.currentTime = times[i];
		});
		tidy(el);
		if (owned && props.every((p) => closed[p] === open[p])) {
			finish();
			return;
		}
		const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		const frames = shown ? [closed, open] : [open, closed];
		const k = owned || !box.slice(2).some((p) => parseFloat(open[p])) ? 1 : EDGE / parseFloat(open[size]);
		const edge = Object.fromEntries(props.map((p) => [p, box.includes(p) ? "0px" : open[p].replace(/[-\d.]+/, (n) => n * k)]));
		if (k < 1) frames.splice(1, 0, {
			...edge,
			...still,
			offset: shown ? k : 1 - k
		});
		const animation = anim.current = el.animate(frames, {
			id: ID,
			duration: reduced ? 0 : duration,
			easing,
			fill: shown ? "backwards" : "both"
		});
		animation.onfinish = () => {
			if (anim.current === animation && alive.current) finish();
		};
	}, [
		shown,
		mounted,
		Tag,
		axis,
		fade,
		duration,
		easing,
		plugins,
		owned
	]);
	useLayoutEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			queueMicrotask(() => {
				if (alive.current) return;
				anim.current?.cancel();
				anim.current = null;
			});
		};
	}, []);
	if (!mounted) return null;
	return /* @__PURE__ */ jsx(Tag, {
		ref: attach,
		...rest,
		children: shown || owned ? children : kept
	});
}
//#endregion
//#region src/presence.jsx
var PresenceChild = ({ id, present, appear, swap, onExited, children }) => {
	const value = useMemo(() => ({
		present,
		appear,
		swap,
		onExited: () => onExited(id)
	}), [
		id,
		present,
		appear,
		swap,
		onExited
	]);
	return /* @__PURE__ */ jsx(PresenceContext, {
		value,
		children
	});
};
var sync = (list, children, wait, appear = true) => {
	const next = Children.toArray(children).filter(isValidElement);
	const keys = new Set(next.map((el) => el.key));
	const known = new Map(list.map((item) => [item.key, item]));
	const items = next.map((el) => ({
		key: el.key,
		el,
		present: true,
		appear: known.get(el.key)?.appear ?? appear
	}));
	let at = 0;
	const left = /* @__PURE__ */ new Set();
	list.forEach((item) => {
		if (keys.has(item.key)) {
			if (item.present) at = items.findIndex((next) => next.key === item.key) + 1;
		} else if (!item.pending) {
			const leaver = item.present ? {
				...item,
				present: false,
				swap: false
			} : item;
			if (item.present) left.add(leaver);
			items.splice(at++, 0, leaver);
		}
	});
	const fresh = (item) => item.present && (known.get(item.key)?.pending ?? !known.has(item.key));
	const leaving = left.size > 0 || list.some((item) => item.pending);
	if (!wait || !leaving || !items.some((item) => !item.present) || !items.some(fresh)) return {
		children,
		list: items
	};
	const mark = (item) => left.has(item) ? {
		...item,
		swap: true
	} : fresh(item) ? {
		...item,
		pending: true,
		swap: true
	} : item;
	return {
		children,
		list: items.map(mark)
	};
};
var release = (list) => list.some((item) => !item.present) ? list : list.map((item) => item.pending ? {
	...item,
	pending: false
} : item);
function Presence({ children, wait = false }) {
	const [state, setState] = useState(() => sync([], children, wait, false));
	if (state.children !== children) setState(sync(state.list, children, wait));
	const remove = useCallback((key) => setState((prev) => prev.list.some((item) => item.key === key && !item.present) ? {
		...prev,
		list: release(prev.list.filter((item) => item.key !== key))
	} : prev), []);
	return state.list.map(({ key, el, present, appear, pending, swap = false }) => !pending && /* @__PURE__ */ jsx(PresenceChild, {
		id: key,
		present,
		appear,
		swap,
		onExited: remove,
		children: el
	}, key));
}
//#endregion
//#region src/clamp.js
var createClamp = ({ lines = 3, onOverflow } = {}) => {
	const closed = (el, on) => {
		Object.assign(el.style, on ? {
			maxHeight: lines + "lh",
			overflow: "clip"
		} : {
			maxHeight: "",
			overflow: ""
		});
		tidy(el);
	};
	const check = (el) => {
		if (el.getAnimations().some((a) => a.id === "collapse")) return;
		const on = !!el.style.maxHeight;
		const [natural, clamped] = [false, true].map((state) => {
			closed(el, state);
			return el.getBoundingClientRect().height;
		});
		closed(el, on);
		const more = natural - clamped > .5;
		if (more === el.hasAttribute("data-overflow")) return;
		el.toggleAttribute("data-overflow", more);
		onOverflow?.(more);
	};
	return {
		unmountOnExit: false,
		frame: { overflow: "clip" },
		closed,
		observe: (el) => {
			if (!globalThis.ResizeObserver) return;
			const run = () => check(el);
			const watch = [new ResizeObserver(run), new MutationObserver(run)];
			watch[0].observe(el);
			watch[1].observe(el, {
				childList: true,
				characterData: true,
				subtree: true
			});
			return () => watch.forEach((w) => w.disconnect());
		}
	};
};
var clamp = /* @__PURE__ */ createClamp();
//#endregion
export { Collapse, Presence, clamp, createClamp };
