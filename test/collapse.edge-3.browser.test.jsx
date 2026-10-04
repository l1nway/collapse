import {afterEach, expect, test, vi} from 'vitest'
import {Activity} from 'react'
import {block, finish, half, near, render, settle, size, ui} from './helpers.jsx'

const stub = state => vi.spyOn(window, 'matchMedia').mockImplementation(media => ({media, matches: state.reduce && media.includes('reduce')}))
const timing = animate => animate.mock.calls.at(-1)[1].duration
const finishAll = async host => {
    host.getAnimations({subtree: true}).forEach(animation => animation.finish())
    await settle()
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

test.each([[false, 0], [true, 100]])('Activity reveal keeps a Collapse with in=%s at its rest size', async (open, rest) => {
    const view = mode => <Activity mode={mode}>{ui({in: open, unmountOnExit: false})}</Activity>
    const {host, rerender} = await render(view('visible'))
    const el = host.firstChild
    near(size(el), rest)
    await rerender(view('hidden'))
    await settle()
    await rerender(view('visible'))
    near(size(el), rest)
    await settle()
    near(size(el), rest)
    expect(el.getAnimations().filter(animation => animation.playState === 'running')).toHaveLength(0)
})

test('reduced motion runs zero-length animations and still completes enter and exit', async () => {
    stub({reduce: true})
    const animate = vi.spyOn(Element.prototype, 'animate')
    const onEntered = vi.fn()
    const onExited = vi.fn()
    const {host, rerender} = await render(ui({in: false, onEntered, onExited}))
    await rerender(ui({in: true, onEntered, onExited}))
    expect(timing(animate)).toBe(0)
    await settle()
    expect(onEntered).toHaveBeenCalledOnce()
    near(size(host.firstChild), 100)
    await rerender(ui({in: false, onEntered, onExited}))
    expect(timing(animate)).toBe(0)
    await settle()
    expect(onExited).toHaveBeenCalledOnce()
    expect(host.firstChild).toBe(null)
})

test('a reduced motion change while mounted applies to the next animation', async () => {
    const state = {reduce: false}
    stub(state)
    const animate = vi.spyOn(Element.prototype, 'animate')
    const onEntered = vi.fn()
    const {host, rerender} = await render(ui({in: true, onEntered}))
    const el = host.firstChild
    await rerender(ui({in: false, onEntered}))
    expect(timing(animate)).toBe(1000)
    await finish(el)
    state.reduce = true
    await rerender(ui({in: true, onEntered}))
    expect(timing(animate)).toBe(0)
    await settle()
    expect(onEntered).toHaveBeenCalledOnce()
    state.reduce = false
    await rerender(ui({in: false, onEntered}))
    expect(timing(animate)).toBe(1000)
})

test('without element.animate enter and exit switch at once and fire the callbacks', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
    delete Element.prototype.animate
    try {
        const onEntered = vi.fn()
        const onExited = vi.fn()
        const {host, rerender} = await render(ui({in: false, onEntered, onExited}))
        await rerender(ui({in: true, onEntered, onExited}))
        expect(onEntered).toHaveBeenCalledOnce()
        near(size(host.firstChild), 100)
        await rerender(ui({in: false, onEntered, onExited}))
        expect(onExited).toHaveBeenCalledOnce()
        expect(host.firstChild).toBe(null)
        await render(ui({in: false, unmountOnExit: false}))
    } finally {
        Object.defineProperty(Element.prototype, 'animate', descriptor)
    }
})

test('without window.matchMedia the animation runs with its duration', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const animate = vi.spyOn(Element.prototype, 'animate')
    const onEntered = vi.fn()
    const {host, rerender} = await render(ui({in: false, onEntered}))
    await rerender(ui({in: true, onEntered}))
    expect(timing(animate)).toBe(1000)
    await finish(host.firstChild)
    expect(onEntered).toHaveBeenCalledOnce()
})

test('timing, axis and fade changed while shown at rest start no animation', async () => {
    const {host, rerender} = await render(ui({in: true}))
    const el = host.firstChild
    for (const props of [{duration: 50}, {easing: 'ease-in'}, {axis: 'x'}, {fade: true}]) {
        await rerender(ui({in: true, ...props}))
        expect(el.getAnimations()).toHaveLength(0)
        near(size(el), 100)
    }
})

test.each([['enter', true], ['exit', false]])('timing, axis and fade changed mid-%s keep the running animation', async (_, to) => {
    const onEntered = vi.fn()
    const onExited = vi.fn()
    const base = {onEntered, onExited}
    const {host, rerender} = await render(ui({...base, in: !to}))
    await rerender(ui({...base, in: to}))
    const el = host.firstChild
    const [animation] = el.getAnimations()
    await rerender(ui({...base, in: to, duration: 2000, easing: 'ease-in', axis: 'x', fade: true}))
    expect(el.getAnimations()).toHaveLength(1)
    expect(el.getAnimations()[0]).toBe(animation)
    near(half(el), 50)
    await finish(el)
    expect(to ? onEntered : onExited).toHaveBeenCalledOnce()
    expect(host.firstChild).toBe(to ? el : null)
    if (to) near(size(el), 100)
})

test('two Collapses toggled in one commit animate independently and both finish', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const pair = open => <>{ui({in: open, onEntered: first})}{ui({in: open, duration: 2000, onEntered: second})}</>
    const {host, rerender} = await render(pair(false))
    await rerender(pair(true))
    const [a, b] = host.children
    b.getAnimations().forEach(animation => animation.pause())
    near(half(a), 50)
    near(half(b), 25)
    await finish(a)
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
    near(size(a), 100)
    expect(b.getAnimations()).toHaveLength(1)
    await finish(b)
    expect(second).toHaveBeenCalledOnce()
    near(size(b), 100)
})

test('a nested Collapse opening in the same commit ends at natural size inside the outer', async () => {
    const outerDone = vi.fn()
    const innerDone = vi.fn()
    const nested = open => ui({in: open, unmountOnExit: false, onEntered: innerDone})
    const tree = open => ui({in: open, unmountOnExit: false, onEntered: outerDone, children: <>{block}{nested(open)}</>})
    const {host, rerender} = await render(tree(false))
    await rerender(tree(true))
    const outer = host.firstChild
    const inner = outer.lastChild
    expect(outer.getAnimations()).toHaveLength(1)
    expect(inner.getAnimations()).toHaveLength(1)
    near(parseFloat(outer.getAnimations()[0].effect.getKeyframes()[1].height), 200)
    expect(size(inner)).toBeLessThan(50)
    await finishAll(host)
    near(size(inner), 100)
    near(size(outer), 200)
    expect(host.getAnimations({subtree: true})).toHaveLength(0)
    expect(outerDone).toHaveBeenCalledOnce()
    expect(innerDone).toHaveBeenCalledOnce()
})
