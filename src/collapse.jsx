import {createContext, useCallback, useContext, useEffectEvent, useLayoutEffect, useRef, useState} from 'react'

const AXES = {
    x: ['width', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'],
    y: ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
}
// clip only while animating
const STILL = {overflow: 'hidden', textOverflow: 'clip', boxSizing: 'border-box'}
// [DOC: collapse-frames]
const LIMITS = {x: {minWidth: '0px', maxWidth: 'none'}, y: {minHeight: '0px', maxHeight: 'none'}}
// [DOC: collapse-edge]
const EDGE = 3
const DURATION = 300
const EASING = 'ease'
// [DOC: collapse-nested]
export const ID = 'collapse'
// [DOC: collapse-plugins]
const NONE = []
const call = (plugins, hook, ...args) => plugins.map(plugin => plugin[hook]?.(...args))
// [DOC: collapse-measure]
export const tidy = el => {if (!el.getAttribute('style')) el.removeAttribute('style')}

// [DOC: presence]
export const PresenceContext = /* @__PURE__ */ createContext(null)

// [DOC: collapse]
export function Collapse({
    as: Tag = 'div', axis = 'y', fade = false, in: inProp, plugins = NONE, duration: durationProp, easing = EASING,
    unmountOnExit = !plugins.some(plugin => plugin.unmountOnExit === false), ref, onEntered, onExited, children, ...rest
}) {
    const owned = plugins.some(plugin => plugin.closed)
    const presence = useContext(PresenceContext)
    const byPresence = inProp === undefined && !!presence
    const shown = byPresence ? presence.present : !!inProp
    // [DOC: presence-wait]
    const duration = durationProp ?? DURATION / (byPresence && presence.swap ? 2 : 1)
    const node = useRef(null)
    const anim = useRef(null)
    const alive = useRef(false)

    const [initial] = useState(() => byPresence && presence.appear ? !shown : shown)
    const last = useRef(initial)
    const [gone, setGone] = useState(!shown)
    if (shown && gone) setGone(false)
    // [DOC: collapse-frozen]
    const [kept, keep] = useState(children)
    if (shown && kept !== children) keep(children)

    const mounted = !(gone && unmountOnExit)
    // [DOC: collapse-ref]
    const attach = useCallback(el => {
        const set = value => typeof ref === 'function' ? ref(value) : ref && (ref.current = value)
        node.current = el
        const detach = set(el)
        // [DOC: collapse-plugins]
        const stops = call(plugins, 'observe', el)
        return () => {
            node.current = null
            stops.forEach(stop => stop?.())
            if (typeof detach === 'function') detach()
            else set(null)
        }
    }, [ref, plugins])

    const finish = useEffectEvent(() => {
        // [DOC: collapse-plugins]
        if (!shown) call(plugins, 'closed', node.current, true)
        if (shown || owned) {
            anim.current?.cancel()
            anim.current = null
        }
        if (shown) {
            onEntered?.()
            return
        }
        onExited?.()
        if (byPresence) presence.onExited()
        if (unmountOnExit) {
            anim.current = null
            setGone(true)
        }
    })

    useLayoutEffect(() => {
        const el = node.current
        if (!el) return
        const props = fade ? [...AXES[axis], 'opacity'] : AXES[axis]
        const still = Object.assign({}, STILL, LIMITS[axis], ...plugins.map(p => p.frame))
        const zero = {...Object.fromEntries(props.map(p => [p, p === 'opacity' ? 0 : '0px'])), ...still}
        // [DOC: collapse-plugins]
        const rest = on => call(plugins, 'closed', el, on)

        // unchanged: hold hidden state
        if (last.current === shown) {
            if (!shown && owned) rest(true)
            // [DOC: collapse-hold]
            else if (!shown && anim.current?.effect?.target !== el && el.animate) anim.current = el.animate([zero, zero], {id: ID, fill: 'forwards'})
            return
        }
        last.current = shown
        rest(false)

        const running = anim.current
        // [DOC: collapse-reverse]
        if (running?.playState === 'running') {
            running.reverse()
            return
        }
        running?.cancel()
        if (!el.animate) {
            finish()
            return
        }
        // [DOC: collapse-nested]
        const nested = shown ? el.getAnimations({subtree: true}).filter(a => a.id === ID && a.effect.target !== el) : []
        const times = nested.map(a => a.currentTime)
        nested.forEach(a => {a.currentTime = a.playbackRate < 0 ? 0 : a.effect.getComputedTiming().endTime})
        const [size, , end, ...box] = AXES[axis]
        // [DOC: collapse-measure]
        const measure = () => {
            const base = el.getBoundingClientRect().bottom
            const {overflow} = el.style
            el.style.overflow = still.overflow
            const computed = getComputedStyle(el)
            const px = p => parseFloat(computed[p])
            const frame = {...Object.fromEntries(props.map(p => [p, computed[p]])), ...still}
            // [DOC: collapse-border-box]
            const full = computed.boxSizing === 'border-box' ? px(size) : box.reduce((sum, p) => sum + px(p), px(size))
            // [DOC: collapse-margin-shift]
            const {bottom, height} = el.getBoundingClientRect()
            const shift = axis === 'y' && height ? (bottom - base) * full / height : 0
            frame[size] = full - shift + 'px'
            frame[end] = px(end) + shift + 'px'
            el.style.overflow = overflow
            return frame
        }
        const open = measure()
        // [DOC: collapse-plugins]
        rest(true)
        const closed = owned ? measure() : zero
        rest(false)
        nested.forEach((a, i) => {a.currentTime = times[i]})
        tidy(el)
        if (owned && props.every(p => closed[p] === open[p])) {
            finish()
            return
        }
        // [DOC: collapse-reduced-motion]
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const frames = shown ? [closed, open] : [open, closed]
        // [DOC: collapse-edge]
        const k = owned || !box.slice(2).some(p => parseFloat(open[p])) ? 1 : EDGE / parseFloat(open[size])
        const edge = Object.fromEntries(props.map(p => [p, box.includes(p) ? '0px' : open[p].replace(/[-\d.]+/, n => n * k)]))
        if (k < 1) frames.splice(1, 0, {...edge, ...still, offset: shown ? k : 1 - k})
        // [DOC: collapse-frames]
        const animation = anim.current = el.animate(frames, {id: ID, duration: reduced ? 0 : duration, easing, fill: shown ? 'backwards' : 'both'})
        animation.onfinish = () => {if (anim.current === animation && alive.current) finish()}
    }, [shown, mounted, Tag, axis, fade, duration, easing, plugins, owned])

    // [DOC: collapse-reconnect]
    useLayoutEffect(() => {
        alive.current = true
        return () => {
            alive.current = false
            queueMicrotask(() => {
                if (alive.current) return
                anim.current?.cancel()
                anim.current = null
            })
        }
    }, [])

    if (!mounted) return null
    return <Tag ref={attach} {...rest}>{shown || owned ? children : kept}</Tag>
}
