import {createContext, useCallback, useContext, useEffectEvent, useLayoutEffect, useRef, useState} from 'react'

const AXES = {
    x: ['width', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'],
    y: ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
}
// [DOC: collapse-frames]
const LIMITS = {x: {minWidth: '0px', maxWidth: 'none'}, y: {minHeight: '0px', maxHeight: 'none'}}
// [DOC: collapse-edge]
const EDGE = 3
const DURATION = 300
const EASING = 'ease'
// [DOC: collapse-nested]
const ID = 'collapse'

// [DOC: presence]
export const PresenceContext = /* @__PURE__ */ createContext(null)

// [DOC: collapse]
export function Collapse({
    as: Tag = 'div', axis = 'y', fade = false, in: inProp, unmountOnExit = true, duration: durationProp, easing = EASING,
    ref, onEntered, onExited, children, ...rest
}) {
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
        return () => {
            node.current = null
            if (typeof detach === 'function') detach()
            else set(null)
        }
    }, [ref])

    const finish = useEffectEvent(() => {
        if (shown) {
            anim.current?.cancel()
            anim.current = null
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
        // clip only while animating
        const still = {overflow: 'hidden', textOverflow: 'clip', boxSizing: 'border-box', ...LIMITS[axis]}
        const closed = {...Object.fromEntries(props.map(p => [p, p === 'opacity' ? 0 : '0px'])), ...still}

        // unchanged: hold hidden state
        if (last.current === shown) {
            // [DOC: collapse-hold]
            if (!shown && anim.current?.effect?.target !== el && el.animate) anim.current = el.animate([closed, closed], {id: ID, fill: 'forwards'})
            return
        }
        last.current = shown

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
        // [DOC: collapse-measure]
        const rest = el.getBoundingClientRect().bottom
        const {overflow} = el.style
        el.style.overflow = 'hidden'
        const computed = getComputedStyle(el)
        const px = p => parseFloat(computed[p])
        const open = {...Object.fromEntries(props.map(p => [p, computed[p]])), ...still}
        // [DOC: collapse-border-box]
        const [size, , end, ...box] = AXES[axis]
        const full = computed.boxSizing === 'border-box' ? px(size) : box.reduce((sum, p) => sum + px(p), px(size))
        // [DOC: collapse-margin-shift]
        const {bottom, height} = el.getBoundingClientRect()
        const shift = axis === 'y' && height ? (bottom - rest) * full / height : 0
        open[size] = full - shift + 'px'
        open[end] = px(end) + shift + 'px'
        nested.forEach((a, i) => {a.currentTime = times[i]})
        el.style.overflow = overflow
        if (!el.getAttribute('style')) el.removeAttribute('style')
        // [DOC: collapse-reduced-motion]
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const frames = shown ? [closed, open] : [open, closed]
        // [DOC: collapse-edge]
        const k = EDGE / parseFloat(open[size])
        const edge = Object.fromEntries(props.map(p => [p, box.includes(p) ? '0px' : open[p].replace(/[-\d.]+/, n => n * k)]))
        if (k < 1 && px(box[2]) + px(box[3])) frames.splice(1, 0, {...edge, ...still, offset: shown ? k : 1 - k})
        // [DOC: collapse-frames]
        const animation = anim.current = el.animate(frames, {id: ID, duration: reduced ? 0 : duration, easing, fill: shown ? 'backwards' : 'both'})
        animation.onfinish = () => {if (anim.current === animation && alive.current) finish()}
    }, [shown, mounted, Tag, axis, fade, duration, easing])

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
    return <Tag ref={attach} {...rest}>{shown ? children : kept}</Tag>
}
