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
var PresenceContext = /* @__PURE__ */ createContext(null);
function Collapse({ as: Tag = "div", axis = "y", fade = false, in: inProp, unmountOnExit = true, duration: durationProp, easing = EASING, ref, onEntered, onExited, children, ...rest }) {
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
		return () => {
			node.current = null;
			if (typeof detach === "function") detach();
			else set(null);
		};
	}, [ref]);
	const finish = useEffectEvent(() => {
		if (shown) {
			anim.current?.cancel();
			anim.current = null;
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
		const still = {
			overflow: "hidden",
			textOverflow: "clip",
			boxSizing: "border-box",
			...LIMITS[axis]
		};
		const closed = {
			...Object.fromEntries(props.map((p) => [p, p === "opacity" ? 0 : "0px"])),
			...still
		};
		if (last.current === shown) {
			if (!shown && anim.current?.effect?.target !== el && el.animate) anim.current = el.animate([closed, closed], {
				id: ID,
				fill: "forwards"
			});
			return;
		}
		last.current = shown;
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
		const nested = shown ? el.getAnimations({ subtree: true }).filter((a) => a.id === ID && a.effect.target !== el) : [];
		const times = nested.map((a) => a.currentTime);
		nested.forEach((a) => {
			a.currentTime = a.playbackRate < 0 ? 0 : a.effect.getComputedTiming().endTime;
		});
		const rest = el.getBoundingClientRect().bottom;
		const { overflow } = el.style;
		el.style.overflow = "hidden";
		const computed = getComputedStyle(el);
		const px = (p) => parseFloat(computed[p]);
		const open = {
			...Object.fromEntries(props.map((p) => [p, computed[p]])),
			...still
		};
		const [size, , end, ...box] = AXES[axis];
		const full = computed.boxSizing === "border-box" ? px(size) : box.reduce((sum, p) => sum + px(p), px(size));
		const { bottom, height } = el.getBoundingClientRect();
		const shift = axis === "y" && height ? (bottom - rest) * full / height : 0;
		open[size] = full - shift + "px";
		open[end] = px(end) + shift + "px";
		nested.forEach((a, i) => {
			a.currentTime = times[i];
		});
		el.style.overflow = overflow;
		if (!el.getAttribute("style")) el.removeAttribute("style");
		const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		const frames = shown ? [closed, open] : [open, closed];
		const k = EDGE / parseFloat(open[size]);
		const edge = Object.fromEntries(props.map((p) => [p, box.includes(p) ? "0px" : open[p].replace(/[-\d.]+/, (n) => n * k)]));
		if (k < 1 && px(box[2]) + px(box[3])) frames.splice(1, 0, {
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
		easing
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
		children: shown ? children : kept
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
export { Collapse, Presence };
