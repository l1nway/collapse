import {expect, test, vi} from 'vitest'
import {Collapse, Presence} from '../src/index.js'
import {finish, H, item, order, render, seek, settle, size} from './helpers.jsx'

const list = (keys, wait = true, props) => <Presence wait={wait}>{keys.map(k => item(k, props))}</Presence>
const node = (view, k) => view.host.querySelector(`[data-key='${k}']`)
const timing = el => el.getAnimations().map(animation => animation.effect.getTiming().duration)
const drain = async () => {
    for (let i = 0; i < 10 && document.getAnimations().length; i++) {
        document.getAnimations().forEach(animation => animation.finish())
        await settle()
    }
}

test('a Collapse with its own in ignores the Presence while the driven one leaves', async () => {
    const pair = k => <div key={k} data-key={k}>
        <Collapse className='driven'><div style={{height: H}}/></Collapse>
        <Collapse in className='own'><div style={{height: H}}/></Collapse>
    </div>
    const view = await render(<Presence>{[pair('a')]}</Presence>)
    await view.rerender(<Presence>{[pair('a'), pair('b')]}</Presence>)
    const b = node(view, 'b')
    const [driven, own] = [b.querySelector('.driven'), b.querySelector('.own')]
    expect([driven.getAnimations().length, own.getAnimations().length]).toEqual([1, 0])
    await finish(driven)
    await view.rerender(<Presence>{[pair('a')]}</Presence>)
    expect([driven.getAnimations().length, own.getAnimations().length]).toEqual([1, 0])
    seek(driven, 150)
    expect(size(own)).toBe(H)
    await finish(driven)
    expect(order(view)).toEqual(['a'])
})

test('a child without a presence-driven Collapse never leaves', async () => {
    const plain = keys => <Presence>{keys.map(k => <p key={k} data-key={k}>{k}</p>)}</Presence>
    const view = await render(plain(['a', 'b']))
    await view.rerender(plain(['a']))
    await settle()
    await settle()
    expect(order(view)).toEqual(['a', 'b'])
})

test('wait swap mounts the new child only after the old one left, both at half duration', async () => {
    const view = await render(list(['a']))
    const a = node(view, 'a')
    await view.rerender(list(['b']))
    expect(order(view)).toEqual(['a'])
    expect(timing(a)).toEqual([150])
    await finish(a)
    const b = node(view, 'b')
    expect(order(view)).toEqual(['b'])
    expect(timing(b)).toEqual([150])
    seek(b, 0)
    expect(size(b)).toBe(0)
    await finish(b)
    expect(b.getAnimations()).toHaveLength(0)
    expect(size(b)).toBe(H)
})

test('wait swap keeps an explicit duration', async () => {
    const view = await render(list(['a'], true, {duration: 400}))
    const a = node(view, 'a')
    await view.rerender(list(['b'], true, {duration: 400}))
    expect(timing(a)).toEqual([400])
    await finish(a)
    expect(timing(node(view, 'b'))).toEqual([400])
})

test('wait does not delay a pure removal and keeps its full duration', async () => {
    const view = await render(list(['a', 'b']))
    await view.rerender(list(['a']))
    expect(order(view)).toEqual(['a', 'b'])
    expect(timing(node(view, 'b'))).toEqual([300])
})

test('wait does not delay a pure addition and keeps its full duration', async () => {
    const view = await render(list(['a']))
    await view.rerender(list(['a', 'b']))
    expect(order(view)).toEqual(['a', 'b'])
    expect(timing(node(view, 'b'))).toEqual([300])
})

test('wait swap back to the leaver reverses it and never mounts the waiting child', async () => {
    const view = await render(list(['a']))
    const a = node(view, 'a')
    await view.rerender(list(['b']))
    seek(a, 75)
    const [exit] = a.getAnimations()
    await view.rerender(list(['a']))
    expect(order(view)).toEqual(['a'])
    expect(a.getAnimations()[0]).toBe(exit)
    await exit.ready
    expect(exit.playbackRate).toBeLessThan(0)
    await finish(a)
    await settle()
    expect(order(view)).toEqual(['a'])
    expect(node(view, 'a')).toBe(a)
    expect(a.getAnimations()).toHaveLength(0)
    expect(size(a)).toBe(H)
})

test('wait holds a key added while another waits until the leaver is gone', async () => {
    const view = await render(list(['a']))
    const a = node(view, 'a')
    await view.rerender(list(['b']))
    await view.rerender(list(['b', 'c']))
    expect(order(view)).toEqual(['a'])
    await finish(a)
    expect(order(view)).toEqual(['b', 'c'])
    expect([timing(node(view, 'b')), timing(node(view, 'c'))]).toEqual([[150], [150]])
})

test('without wait a swap runs exit and enter together at full duration', async () => {
    const view = await render(list(['a'], false))
    await view.rerender(list(['b'], false))
    expect(order(view)).toEqual(['a', 'b'])
    expect([timing(node(view, 'a')), timing(node(view, 'b'))]).toEqual([[300], [300]])
})

test('the swap mark clears so the next pure removal runs at full duration', async () => {
    const view = await render(list(['a']))
    const a = node(view, 'a')
    await view.rerender(list(['b']))
    await finish(a)
    const b = node(view, 'b')
    await finish(b)
    await view.rerender(list([]))
    expect(order(view)).toEqual(['b'])
    expect(timing(b)).toEqual([300])
})

test.each([false, true])('rapid changes end in exactly the final list with no animations left (wait %s)', async wait => {
    const steps = [['a', 'c', 'd'], ['d', 'b', 'a'], ['e', 'a'], ['a', 'b', 'e', 'f'], ['f', 'c', 'a'], ['c', 'g', 'a']]
    const view = await render(list(['a', 'b', 'c'], wait))
    for (const [i, keys] of steps.entries()) {
        await view.rerender(list(keys, wait))
        document.getAnimations().forEach(animation => {animation.currentTime = 20 + i * 15})
        await settle()
    }
    await drain()
    expect(order(view)).toEqual(['c', 'g', 'a'])
    expect(document.getAnimations()).toHaveLength(0)
    view.host.querySelectorAll('[data-key]').forEach(el => expect(size(el)).toBe(H))
})

test('unmounting Presence while children animate throws nothing and calls nothing back', async () => {
    const error = vi.spyOn(console, 'error')
    const props = {onExited: vi.fn(), onEntered: vi.fn()}
    const view = await render(list(['a', 'b'], false, props))
    await view.rerender(list(['a', 'c'], false, props))
    const running = document.getAnimations()
    expect(running).toHaveLength(2)
    running.forEach(animation => {animation.currentTime = 100})
    await view.unmount()
    running.forEach(animation => animation.finish())
    await settle()
    expect(props.onExited).not.toHaveBeenCalled()
    expect(props.onEntered).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
})
