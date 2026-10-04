import {describe, expect, test} from 'vitest'
import {Collapse} from '../src/collapse.jsx'
import {finish, frames, near, render, seek, settle, size, spies} from './helpers.jsx'

const Y = ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
const zero = {...Object.fromEntries(Y.map(p => [p, '0px'])), overflow: 'hidden', minHeight: '0px', maxHeight: 'none'}
const zeroed = el => Y.forEach(p => expect(getComputedStyle(el)[p]).toBe('0px'))

const box = props => shown => (
    <Collapse in={shown} duration={1000} easing='linear' {...props}><div style={{height: 100}}/></Collapse>
)

const setup = async (props, shown) => {
    const ui = box(props)
    const view = await render(ui(shown))
    return {...view, el: () => view.host.firstElementChild, toggle: next => view.rerender(ui(next))}
}

describe('Collapse at rest', () => {
    test('mounted shown renders at natural size with no animation and no style attribute', async () => {
        const {el} = await setup({}, true)
        expect(el().getAnimations()).toEqual([])
        expect(el().hasAttribute('style')).toBe(false)
        expect(size(el())).toBe(100)
    })

    test('mounted hidden renders nothing by default', async () => {
        const {host} = await setup({}, false)
        expect(host.innerHTML).toBe('')
    })

    test('mounted hidden with unmountOnExit false holds a zero box without motion or style attribute', async () => {
        const {el} = await setup({unmountOnExit: false}, false)
        await settle()
        expect(size(el())).toBe(0)
        zeroed(el())
        expect(el().hasAttribute('style')).toBe(false)
        expect(el().getAnimations().every(a => a.playState === 'finished')).toBe(true)
    })
})

describe('Collapse transitions', () => {
    test('enter animates the whole box from zero to the measured size and leaves no trace', async () => {
        const calls = spies()
        const {el, toggle} = await setup(calls, false)
        await toggle(true)
        expect(el().getAnimations()).toHaveLength(1)
        const [from, to] = frames(el())
        expect(from).toMatchObject(zero)
        expect(to).toMatchObject({...zero, height: '100px'})
        seek(el(), 500)
        near(size(el()), 50)
        await finish(el())
        expect(calls.onEntered).toHaveBeenCalledTimes(1)
        expect(calls.onExited).not.toHaveBeenCalled()
        expect(el().getAnimations()).toEqual([])
        expect(el().getAttribute('style')).toBe(null)
        expect(size(el())).toBe(100)
    })

    test('exit animates from the measured size to zero and unmounts', async () => {
        const calls = spies()
        const {el, host, toggle} = await setup(calls, true)
        await toggle(false)
        expect(el().getAnimations()).toHaveLength(1)
        const [from, to] = frames(el())
        expect(from).toMatchObject({...zero, height: '100px'})
        expect(to).toMatchObject(zero)
        seek(el(), 500)
        near(size(el()), 50)
        await finish(el())
        expect(calls.onExited).toHaveBeenCalledTimes(1)
        expect(calls.onEntered).not.toHaveBeenCalled()
        expect(host.innerHTML).toBe('')
    })

    test('exit with unmountOnExit false keeps the element at a zero box', async () => {
        const calls = spies()
        const {el, toggle} = await setup({unmountOnExit: false, ...calls}, true)
        const node = el()
        await toggle(false)
        await finish(node)
        expect(el()).toBe(node)
        expect(size(node)).toBe(0)
        zeroed(node)
        expect(calls.onExited).toHaveBeenCalledTimes(1)
        expect(calls.onEntered).not.toHaveBeenCalled()
    })
})

describe('Collapse interruptions', () => {
    test('closing mid-enter reverses the same animation without a jump and unmounts', async () => {
        const calls = spies()
        const {el, host, toggle} = await setup(calls, false)
        await toggle(true)
        const node = el()
        const [animation] = node.getAnimations()
        seek(node, 400)
        const before = size(node)
        near(before, 40)
        const toggled = toggle(false)
        near(size(node), before)
        await toggled
        await settle()
        expect(node.getAnimations()).toEqual([animation])
        expect(animation.playbackRate).toBeLessThan(0)
        await finish(node)
        expect(host.innerHTML).toBe('')
        expect(calls.onExited).toHaveBeenCalledTimes(1)
        expect(calls.onEntered).not.toHaveBeenCalled()
    })

    test('opening mid-exit reverses the same animation without a jump and ends open', async () => {
        const calls = spies()
        const {el, toggle} = await setup(calls, true)
        const node = el()
        await toggle(false)
        const [animation] = node.getAnimations()
        seek(node, 400)
        const before = size(node)
        near(before, 60)
        const toggled = toggle(true)
        near(size(node), before)
        await toggled
        await settle()
        expect(node.getAnimations()).toEqual([animation])
        expect(animation.playbackRate).toBeLessThan(0)
        await finish(node)
        expect(el()).toBe(node)
        expect(calls.onEntered).toHaveBeenCalledTimes(1)
        expect(calls.onExited).not.toHaveBeenCalled()
        expect(node.getAnimations()).toEqual([])
        expect(node.getAttribute('style')).toBe(null)
        expect(size(node)).toBe(100)
    })

    test('rapid toggling ends in the final state with one callback and nothing left over', async () => {
        const calls = spies()
        const {el, toggle} = await setup(calls, false)
        await toggle(true)
        for (const [shown, time] of [[false, 300], [true, 100], [false, 900], [true, 500]]) {
            seek(el(), time)
            near(size(el()), time / 10)
            const toggled = toggle(shown)
            near(size(el()), time / 10)
            await toggled
        }
        await finish(el())
        expect(calls.onEntered).toHaveBeenCalledTimes(1)
        expect(calls.onExited).not.toHaveBeenCalled()
        expect(el().getAnimations()).toEqual([])
        expect(el().getAttribute('style')).toBe(null)
        expect(size(el())).toBe(100)
    })
})
