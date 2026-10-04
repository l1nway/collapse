import {expect, test, vi} from 'vitest'
import {createRef} from 'react'
import {finish, frames, half, near, render, seek, settle, size, ui} from './helpers.jsx'

const same = (list, expected) => {
    expect(list).toHaveLength(expected.length)
    list.forEach((value, i) => expect(value).toBe(expected[i]))
}

test('object ref receives the element and the enter still animates', async () => {
    const ref = createRef()
    const {host, rerender} = await render(ui({ref, in: false}))
    await rerender(ui({ref, in: true}))
    const el = host.firstChild
    expect(ref.current).toBe(el)
    expect(el.getAnimations()).toHaveLength(1)
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
})

test('object ref is null after an unmounting exit and points to the new element after re-entering', async () => {
    const ref = createRef()
    const {host, rerender} = await render(ui({ref, in: true}))
    const first = host.firstChild
    await rerender(ui({ref, in: false}))
    expect(ref.current).toBe(first)
    await finish(first)
    expect(host.firstChild).toBe(null)
    expect(ref.current).toBe(null)
    await rerender(ui({ref, in: true}))
    expect(ref.current).toBe(host.firstChild)
    expect(ref.current).not.toBe(first)
})

test('callback ref is called with the element and with null on removal', async () => {
    const calls = []
    const ref = el => {calls.push(el)}
    const {host, rerender} = await render(ui({ref, in: true}))
    const el = host.firstChild
    same(calls, [el])
    await rerender(ui({ref, in: false}))
    await finish(el)
    same(calls, [el, null])
})

test('callback ref cleanup is called instead of null and the next enter animates', async () => {
    const calls = []
    const cleanups = []
    const ref = el => {
        calls.push(el)
        return () => {cleanups.push(el)}
    }
    const {host, rerender} = await render(ui({ref, in: true}))
    const first = host.firstChild
    await rerender(ui({ref, in: false}))
    await finish(first)
    same(calls, [first])
    same(cleanups, [first])
    await rerender(ui({ref, in: true}))
    const next = host.firstChild
    same(calls, [first, next])
    near(half(next), 50)
    await finish(next)
    near(size(next), 100)
})

test('ref focuses the element and an exiting element keeps focus until removed', async () => {
    const ref = createRef()
    const {host, rerender} = await render(ui({ref, in: true, tabIndex: -1}))
    const el = host.firstChild
    expect(el.getAttribute('tabindex')).toBe('-1')
    ref.current.focus()
    expect(document.activeElement).toBe(el)
    await rerender(ui({ref, in: false, tabIndex: -1}))
    el.getAnimations().forEach(animation => animation.pause())
    seek(el, 500)
    await settle()
    expect(document.activeElement).toBe(el)
    await finish(el)
    expect(el.isConnected).toBe(false)
    expect(document.activeElement).toBe(document.body)
})

test('as button forwards type and onClick and animates', async () => {
    const onClick = vi.fn()
    const props = {as: 'button', type: 'button', onClick, children: <span style={{display: 'block', height: '100px'}}/>}
    const {host, rerender} = await render(ui({...props, in: false}))
    await rerender(ui({...props, in: true}))
    const el = host.firstChild
    expect(el.tagName).toBe('BUTTON')
    expect(el.type).toBe('button')
    const mid = half(el)
    await finish(el)
    expect(size(el)).toBeGreaterThan(100)
    near(mid, size(el) / 2)
    el.click()
    expect(onClick).toHaveBeenCalledOnce()
})

test('a border keeps the size in step with the timing to the end, no device pixel snap', async () => {
    const style = {border: '3px solid', padding: 8}
    const {host, rerender} = await render(ui({style, in: false}))
    await rerender(ui({style, in: true}))
    const el = host.firstChild
    expect(frames(el).at(-1)).toMatchObject({height: '122px', boxSizing: 'border-box'})
    seek(el, 990)
    expect(Math.abs(size(el) - 0.99 * 122)).toBeLessThan(0.5)
})

test('a border reaches 0 before the size does, no sliver at the start of an open and the end of a close', async () => {
    const style = {border: '3px solid', padding: 8}
    const {host, rerender} = await render(ui({style, in: false}))
    await rerender(ui({style, in: true}))
    const el = host.firstChild
    const linear = t => [8, 30, 500].forEach(time => {
        seek(el, time)
        expect(Math.abs(size(el) - t(time) * 122)).toBeLessThan(0.5)
    })
    linear(time => time / 1000)
    expect(frames(el)[1]).toMatchObject({offset: 3 / 122, height: '3px', borderTopWidth: '0px', paddingBottom: '0px'})
    await finish(el)
    await rerender(ui({style, in: false}))
    linear(time => 1 - time / 1000)
    seek(el, 992)
    expect(size(el)).toBeLessThan(1.5)
    expect(frames(el)[1]).toMatchObject({offset: 1 - 3 / 122, height: '3px'})
})

test('a child margin collapsing through stays outside the box while animating', async () => {
    const children = <p style={{margin: '0 0 16px', height: 20}}/>
    const {host, rerender} = await render(ui({children, in: false}))
    await rerender(ui({children, in: true}))
    const el = host.firstChild
    expect(frames(el)).toHaveLength(2)
    expect(frames(el)[1]).toMatchObject({height: '20px', marginBottom: '16px'})
    seek(el, 999)
    near(size(el), 20)
    await finish(el)
    expect(size(el)).toBe(20)
    await rerender(ui({children, in: false}))
    expect(frames(el)[0]).toMatchObject({height: '20px', marginBottom: '16px'})
})

const Section = ({ref, ...props}) => <section ref={ref} {...props}/>

test('as a ref-forwarding component animates its element and gets the rest props', async () => {
    const props = {as: Section, id: 'panel', 'data-state': 'open', 'aria-label': 'Panel'}
    const {host, rerender} = await render(ui({...props, in: false}))
    await rerender(ui({...props, in: true}))
    const el = host.firstChild
    expect(el.tagName).toBe('SECTION')
    expect(el.id).toBe('panel')
    expect(el.dataset.state).toBe('open')
    expect(el.getAttribute('aria-label')).toBe('Panel')
    near(half(el), 50)
    await finish(el)
    near(size(el), 100)
})
