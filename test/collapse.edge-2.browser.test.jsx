import {expect, test, vi} from 'vitest'
import {StrictMode, useLayoutEffect, useReducer} from 'react'
import {block, finish, frame, half, near, render, seek, settle, size, ui} from './helpers.jsx'

const Opener = props => {
    const [open, show] = useReducer(() => true, false)
    useLayoutEffect(() => {show()}, [])
    return ui({in: open, unmountOnExit: false, ...props})
}
const counter = () => {
    const count = {renders: 0}
    const Child = () => {
        count.renders++
        return block
    }
    return [count, open => ui({in: open, children: <Child/>})]
}

test('an exit shows the last shown children and reopening shows the new ones', async () => {
    const {host, rerender} = await render(ui({in: true, children: 'A'}))
    const el = host.firstChild
    await rerender(ui({in: false, children: 'B'}))
    seek(el, 500)
    expect(el.textContent).toBe('A')
    await rerender(ui({in: true, children: 'C'}))
    expect(el.textContent).toBe('C')
    await finish(el)
    expect(el.textContent).toBe('C')
})

test('hidden at rest ignores a children change and reopening shows the latest children', async () => {
    const view = (open, children) => ui({in: open, unmountOnExit: false, children})
    const {host, rerender} = await render(view(true, 'A'))
    const el = host.firstChild
    await rerender(view(false, 'A'))
    await finish(el)
    await rerender(view(false, 'B'))
    expect(el.textContent).toBe('A')
    await rerender(view(true, 'B'))
    expect(el.textContent).toBe('B')
})

test('a parent render while shown renders the children exactly once', async () => {
    const [count, view] = counter()
    const {rerender} = await render(view(true))
    expect(count.renders).toBe(1)
    for (const renders of [2, 3, 4]) {
        await rerender(view(true))
        expect(count.renders).toBe(renders)
    }
})

test('frozen children do not render again during an exit', async () => {
    const [count, view] = counter()
    const {host, rerender} = await render(view(true))
    const el = host.firstChild
    await rerender(view(false))
    await rerender(view(false))
    expect(count.renders).toBe(1)
    await finish(el)
    expect(count.renders).toBe(1)
})

test('unmountOnExit turned false while hidden renders the element already held at 0', async () => {
    const {host, rerender} = await render(ui({in: false}))
    expect(host.firstChild).toBe(null)
    await rerender(ui({in: false, unmountOnExit: false}))
    const el = host.firstChild
    expect(size(el)).toBe(0)
    await settle()
    expect(size(el)).toBe(0)
})

test('as changed while hidden holds the new element at 0', async () => {
    const {host, rerender} = await render(ui({in: false, unmountOnExit: false}))
    expect(size(host.firstChild)).toBe(0)
    await rerender(ui({in: false, unmountOnExit: false, as: 'section'}))
    const el = host.firstChild
    expect(el.tagName).toBe('SECTION')
    expect(size(el)).toBe(0)
    await settle()
    expect(size(el)).toBe(0)
})

test('unmountOnExit turned true while hidden and never opened unmounts', async () => {
    const {host, rerender} = await render(ui({in: false, unmountOnExit: false}))
    expect(size(host.firstChild)).toBe(0)
    await rerender(ui({in: false}))
    expect(host.firstChild).toBe(null)
})

test('a hold followed by a show from a parent layout effect animates open', async () => {
    const onEntered = vi.fn()
    const {host} = await render(<Opener onEntered={onEntered}/>)
    const el = host.firstChild
    expect(el.getAnimations()).toHaveLength(1)
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
    expect(onEntered).toHaveBeenCalledOnce()
})

test('a hold followed by a show in the next act animates open', async () => {
    const {host, rerender} = await render(ui({in: false, unmountOnExit: false}))
    await rerender(ui({in: true, unmountOnExit: false}))
    const el = host.firstChild
    expect(el.getAnimations()).toHaveLength(1)
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
})

test('StrictMode enter and exit animate and fire each callback once', async () => {
    const onEntered = vi.fn()
    const onExited = vi.fn()
    const view = open => <StrictMode>{ui({in: open, onEntered, onExited})}</StrictMode>
    const {host, rerender} = await render(view(false))
    await rerender(view(true))
    const el = host.firstChild
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
    await rerender(view(false))
    near(half(el), 50)
    await finish(el)
    expect(host.firstChild).toBe(null)
    expect(onEntered).toHaveBeenCalledOnce()
    expect(onExited).toHaveBeenCalledOnce()
})

test('StrictMode reconnect keeps an animation started on mount', async () => {
    const onEntered = vi.fn()
    const {host} = await render(<StrictMode><Opener onEntered={onEntered}/></StrictMode>)
    const el = host.firstChild
    const [animation] = el.getAnimations()
    await Promise.resolve()
    expect(animation.playState).toBe('running')
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
    expect(onEntered).toHaveBeenCalledOnce()
})

test.each([['enter', false], ['exit', true]])('unmounting mid-%s cancels the animation and calls back nothing', async (_, from) => {
    const onEntered = vi.fn()
    const onExited = vi.fn()
    const error = vi.spyOn(console, 'error')
    try {
        const {host, rerender, unmount} = await render(ui({in: from, onEntered, onExited}))
        await rerender(ui({in: !from, onEntered, onExited}))
        const [animation] = host.firstChild.getAnimations()
        seek(host.firstChild, 500)
        await unmount()
        await frame()
        expect(animation.playState).toBe('idle')
        animation.finish()
        await settle()
        expect(onEntered).not.toHaveBeenCalled()
        expect(onExited).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
    } finally {
        error.mockRestore()
    }
})
