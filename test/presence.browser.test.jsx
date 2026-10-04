import {expect, test, vi} from 'vitest'
import {memo} from 'react'
import {Collapse, Presence} from '../src/index.js'
import {finish, H, item, order, render, seek, settle, size} from './helpers.jsx'

const list = (keys, props) => <Presence>{keys.map(k => item(k, props?.[k]))}</Presence>
const nodes = view => Object.fromEntries([...view.host.querySelectorAll('[data-key]')].map(el => [el.dataset.key, el]))
const same = (view, expected) => {
    const now = nodes(view)
    expect(Object.keys(now).sort()).toEqual(Object.keys(expected).sort())
    Object.keys(now).forEach(k => expect(now[k]).toBe(expected[k]))
}
const watch = view => {
    let seen = {added: [], removed: []}
    const keys = list => [...list].map(el => el.dataset.key)
    const take = records => records.forEach(r => {
        seen = {added: [...seen.added, ...keys(r.addedNodes)], removed: [...seen.removed, ...keys(r.removedNodes)]}
    })
    const observer = new MutationObserver(take)
    observer.observe(view.host, {childList: true})
    return () => {
        take(observer.takeRecords())
        const result = seen
        seen = {added: [], removed: []}
        return result
    }
}

test('children of the first render do not animate', async () => {
    const view = await render(list(['a', 'b']))
    await settle()
    expect(order(view)).toEqual(['a', 'b'])
    expect(document.getAnimations()).toHaveLength(0)
    Object.values(nodes(view)).forEach(el => expect(size(el)).toBe(H))
})

test('a child added later animates in and ends at natural size', async () => {
    const view = await render(list(['a']))
    await view.rerender(list(['a', 'b']))
    const {a, b} = nodes(view)
    expect(a.getAnimations()).toHaveLength(0)
    expect(b.getAnimations()).toHaveLength(1)
    expect(b.getAnimations()[0].effect.getTiming().duration).toBe(300)
    seek(b, 0)
    expect(size(b)).toBe(0)
    seek(b, 150)
    expect(size(b)).toBeGreaterThan(0)
    expect(size(b)).toBeLessThan(H)
    await finish(b)
    expect(b.getAnimations()).toHaveLength(0)
    expect(size(b)).toBe(H)
})

test('a removed child stays mounted during its exit, then unmounts and calls onExited once', async () => {
    const onExited = vi.fn()
    const view = await render(list(['a', 'b'], {b: {onExited}}))
    await view.rerender(list(['a']))
    const {b} = nodes(view)
    expect(order(view)).toEqual(['a', 'b'])
    expect(b.getAnimations()).toHaveLength(1)
    seek(b, 150)
    expect(size(b)).toBeLessThan(H)
    expect(onExited).not.toHaveBeenCalled()
    await finish(b)
    expect(order(view)).toEqual(['a'])
    expect(b.isConnected).toBe(false)
    await settle()
    expect(onExited).toHaveBeenCalledTimes(1)
})

test('a leaving child keeps the props of its last present render', async () => {
    const tagged = (keys, tag) => <Presence>{keys.map(k => <Collapse key={k} data-key={k} className={tag}>{`${k}-${tag}`}</Collapse>)}</Presence>
    const view = await render(tagged(['a', 'b'], 'v1'))
    await view.rerender(tagged(['a'], 'v2'))
    await view.rerender(tagged(['a'], 'v3'))
    const {a, b} = nodes(view)
    expect([a.className, a.textContent]).toEqual(['v3', 'a-v3'])
    expect([b.className, b.textContent]).toEqual(['v1', 'b-v1'])
})

test('removing the middle child keeps order and touches no other node', async () => {
    const view = await render(list(['a', 'b', 'c']))
    const before = nodes(view)
    const records = watch(view)
    await view.rerender(list(['a', 'c']))
    expect(order(view)).toEqual(['a', 'b', 'c'])
    expect(records()).toEqual({added: [], removed: []})
    await finish(before.b)
    expect(order(view)).toEqual(['a', 'c'])
    expect(records()).toEqual({added: [], removed: ['b']})
    same(view, {a: before.a, c: before.c})
})

test('removing two separated children keeps both in place', async () => {
    const view = await render(list(['a', 'b', 'c', 'd', 'e']))
    const before = nodes(view)
    const records = watch(view)
    await view.rerender(list(['a', 'c', 'e']))
    expect(order(view)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(records()).toEqual({added: [], removed: []})
    await finish(before.b)
    expect(order(view)).toEqual(['a', 'c', 'd', 'e'])
    await finish(before.d)
    expect(order(view)).toEqual(['a', 'c', 'e'])
    expect(records()).toEqual({added: [], removed: ['b', 'd']})
    same(view, {a: before.a, c: before.c, e: before.e})
})

test('removing the first child while adding one at the end keeps the leaver first', async () => {
    const view = await render(list(['a', 'b', 'c']))
    const before = nodes(view)
    const records = watch(view)
    await view.rerender(list(['b', 'c', 'x']))
    expect(order(view)).toEqual(['a', 'b', 'c', 'x'])
    const {x} = nodes(view)
    expect(records()).toEqual({added: ['x'], removed: []})
    await finish(before.a)
    expect(order(view)).toEqual(['b', 'c', 'x'])
    same(view, {b: before.b, c: before.c, x})
})

test('a leaver stays after its old neighbour while present children move', async () => {
    const view = await render(list(['a', 'b', 'c', 'd']))
    const before = nodes(view)
    await view.rerender(list(['c', 'a', 'd']))
    expect(order(view)).toEqual(['c', 'a', 'b', 'd'])
    same(view, before)
    await finish(before.b)
    expect(order(view)).toEqual(['c', 'a', 'd'])
    same(view, {a: before.a, c: before.c, d: before.d})
})

test('re-adding a leaving key reverses its exit and keeps it mounted', async () => {
    const onExited = vi.fn()
    const view = await render(list(['a', 'b', 'c'], {b: {onExited}}))
    const {b} = nodes(view)
    await view.rerender(list(['a', 'c'], {b: {onExited}}))
    seek(b, 150)
    const [exit] = b.getAnimations()
    await view.rerender(list(['a', 'b', 'c'], {b: {onExited}}))
    expect(b.getAnimations()).toHaveLength(1)
    expect(b.getAnimations()[0]).toBe(exit)
    await exit.ready
    expect(exit.playbackRate).toBeLessThan(0)
    await finish(b)
    await settle()
    expect(order(view)).toEqual(['a', 'b', 'c'])
    expect(nodes(view).b).toBe(b)
    expect(b.getAnimations()).toHaveLength(0)
    expect(size(b)).toBe(H)
    expect(onExited).not.toHaveBeenCalled()
})

test('non-element children are ignored and an empty Presence renders nothing', async () => {
    const error = vi.spyOn(console, 'error')
    const view = await render(<Presence>{null}{false}{'text'}{3}{item('a')}</Presence>)
    expect(order(view)).toEqual(['a'])
    expect(view.host.textContent).toBe('a')
    await view.rerender(<Presence>{null}{0}{'b'}</Presence>)
    await finish(view.host.querySelector('[data-key]'))
    expect(view.host.innerHTML).toBe('')
    const empty = await render(<Presence/>)
    expect(empty.host.innerHTML).toBe('')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
})

test('a memo child is not re-rendered when a sibling is added or removed', async () => {
    const renders = {}
    const Row = memo(({id}) => {
        renders[id] = (renders[id] ?? 0) + 1
        return <Collapse data-key={id}><div style={{height: H}}/></Collapse>
    })
    const rows = keys => <Presence>{keys.map(k => <Row key={k} id={k}/>)}</Presence>
    const view = await render(rows(['a', 'b']))
    await view.rerender(rows(['a', 'b', 'c']))
    await finish(nodes(view).c)
    const {b} = nodes(view)
    await view.rerender(rows(['a', 'c']))
    await finish(b)
    expect(order(view)).toEqual(['a', 'c'])
    expect(renders).toEqual({a: 1, b: 1, c: 1})
})
