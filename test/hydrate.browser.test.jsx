import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {act} from 'react'
import {hydrateRoot} from 'react-dom/client'
import {renderToString} from 'react-dom/server'
import {Collapse, Presence} from '../src/index.js'
import {finish, seek, settle, size} from './helpers.jsx'

const HEIGHT = 40
const roots = new Set()
let errors

beforeEach(() => {
    errors = []
    vi.spyOn(console, 'error').mockImplementation((...args) => {errors.push(args.join(' '))})
})

afterEach(async () => {
    for (const {root, host} of roots) {
        await act(() => root.unmount())
        host.remove()
    }
    roots.clear()
    vi.restoreAllMocks()
})

const hydrate = async ui => {
    const host = document.body.appendChild(document.createElement('div'))
    const html = host.innerHTML = renderToString(ui)
    const server = [...host.children]
    let root
    await act(() => {root = hydrateRoot(host, ui, {onRecoverableError: error => errors.push(String(error))})})
    roots.add({root, host})
    await settle()
    return {host, server, html, rerender: next => act(() => root.render(next))}
}

const Box = ({id}) => <div className='content' style={{height: HEIGHT}}>{id}</div>

const animating = el => el.getAnimations().length > 0

describe('hydrating Collapse', () => {
    const shown = (show, props) => <Collapse in={show} id='box' {...props}><Box id='box'/></Collapse>

    test('shown: no mismatch, reuses the server node, no enter animation', async () => {
        const onEntered = vi.fn()
        const {host, server, html} = await hydrate(shown(true, {onEntered}))
        expect(errors).toEqual([])
        expect(host.innerHTML).toBe(html)
        const el = host.querySelector('#box')
        expect(el).toBe(server[0])
        expect(animating(el)).toBe(false)
        expect(el.getAttribute('style')).toBe(null)
        expect(size(el)).toBe(HEIGHT)
        expect(onEntered).not.toHaveBeenCalled()
    })

    test('shown: hiding after hydration animates out and unmounts', async () => {
        const onExited = vi.fn()
        const {host, rerender} = await hydrate(shown(true, {onExited}))
        const el = host.querySelector('#box')
        await rerender(shown(false, {onExited}))
        expect(animating(el)).toBe(true)
        seek(el, 150)
        expect(size(el)).toBeGreaterThan(0)
        expect(size(el)).toBeLessThan(HEIGHT)
        await finish(el)
        expect(host.querySelector('#box')).toBe(null)
        expect(onExited).toHaveBeenCalledTimes(1)
        expect(errors).toEqual([])
    })

    test('hidden with unmountOnExit={false}: no mismatch and held at 0 after hydration', async () => {
        const {host, server, html} = await hydrate(shown(false, {unmountOnExit: false}))
        expect(errors).toEqual([])
        expect(host.innerHTML).toBe(html)
        const el = host.querySelector('#box')
        expect(el).toBe(server[0])
        expect(el.querySelector('.content')).not.toBe(null)
        expect(size(el)).toBe(0)
    })

    test('hidden with unmountOnExit={false}: showing after hydration animates normally', async () => {
        const onEntered = vi.fn()
        const props = {unmountOnExit: false, onEntered}
        const {host, rerender} = await hydrate(shown(false, props))
        const el = host.querySelector('#box')
        await rerender(shown(true, props))
        expect(animating(el)).toBe(true)
        seek(el, 0)
        expect(size(el)).toBe(0)
        seek(el, 150)
        expect(size(el)).toBeGreaterThan(0)
        expect(size(el)).toBeLessThan(HEIGHT)
        await finish(el)
        expect(size(el)).toBe(HEIGHT)
        expect(animating(el)).toBe(false)
        expect(el.getAttribute('style')).toBe(null)
        expect(onEntered).toHaveBeenCalledTimes(1)
        await rerender(shown(false, props))
        await finish(el)
        expect(host.querySelector('#box')).toBe(el)
        expect(size(el)).toBe(0)
        expect(errors).toEqual([])
    })

    test('as and forwarded props hydrate without mismatch', async () => {
        const {host, html} = await hydrate(<Collapse in as='section' id='box' className='panel' data-x='1'><Box id='x'/></Collapse>)
        expect(errors).toEqual([])
        expect(html).toMatch(/^<section id="box" class="panel" data-x="1">/)
        expect(host.innerHTML).toBe(html)
    })
})

describe('hydrating Presence', () => {
    const list = (keys, wait = false) => (
        <ul>
            <Presence wait={wait}>
                {keys.map(key => <Collapse key={key} as='li' id={key}><Box id={key}/></Collapse>)}
            </Presence>
        </ul>
    )
    const items = host => [...host.querySelectorAll('li')]

    test.each([false, true])('list hydrates without mismatch or enter animation (wait=%s)', async wait => {
        const {host, server, html} = await hydrate(list(['a', 'b', 'c'], wait))
        expect(errors).toEqual([])
        expect(host.innerHTML).toBe(html)
        expect(host.firstChild).toBe(server[0])
        expect(items(host).map(el => el.id)).toEqual(['a', 'b', 'c'])
        items(host).forEach(el => {
            expect(animating(el)).toBe(false)
            expect(size(el)).toBe(HEIGHT)
        })
    })

    test('removing and adding after hydration animates normally', async () => {
        const {host, rerender} = await hydrate(list(['a', 'b', 'c']))
        const b = host.querySelector('#b')
        await rerender(list(['a', 'c', 'd']))
        const d = host.querySelector('#d')
        expect(items(host).map(el => el.id)).toEqual(['a', 'b', 'c', 'd'])
        expect(animating(b)).toBe(true)
        expect(animating(d)).toBe(true)
        expect(animating(host.querySelector('#a'))).toBe(false)
        seek(d, 0)
        expect(size(d)).toBe(0)
        await finish(b)
        await finish(d)
        expect(items(host).map(el => el.id)).toEqual(['a', 'c', 'd'])
        expect(size(d)).toBe(HEIGHT)
        expect(errors).toEqual([])
    })
})
