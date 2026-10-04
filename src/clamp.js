import {ID, tidy} from './collapse.jsx'

// [DOC: clamp]
export const createClamp = ({lines = 3, onOverflow} = {}) => {
    const closed = (el, on) => {
        Object.assign(el.style, on ? {maxHeight: lines + 'lh', overflow: 'clip'} : {maxHeight: '', overflow: ''})
        tidy(el)
    }
    // [DOC: clamp-overflow]
    const check = el => {
        if (el.getAnimations().some(a => a.id === ID)) return
        const on = !!el.style.maxHeight
        const [natural, clamped] = [false, true].map(state => {
            closed(el, state)
            return el.getBoundingClientRect().height
        })
        closed(el, on)
        const more = natural - clamped > 0.5
        if (more === el.hasAttribute('data-overflow')) return
        el.toggleAttribute('data-overflow', more)
        onOverflow?.(more)
    }
    return {
        unmountOnExit: false,
        frame: {overflow: 'clip'},
        closed,
        observe: el => {
            if (!globalThis.ResizeObserver) return
            const run = () => check(el)
            const watch = [new ResizeObserver(run), new MutationObserver(run)]
            watch[0].observe(el)
            watch[1].observe(el, {childList: true, characterData: true, subtree: true})
            return () => watch.forEach(w => w.disconnect())
        }
    }
}

export const clamp = /* @__PURE__ */ createClamp()
