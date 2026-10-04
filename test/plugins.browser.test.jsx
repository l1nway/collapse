import {describe, expect, test, vi} from 'vitest'
import {block, finish, frames, render, settle, size, spies, ui} from './helpers.jsx'

const log = []
const shelf = {
    unmountOnExit: false,
    frame: {overflow: 'clip'},
    closed: (el, on) => {
        log.push(on)
        el.style.maxHeight = on ? '30px' : ''
    }
}
const PLUGINS = [shelf]
const CLIP = [{frame: {overflow: 'clip'}}]
const box = {padding: '5px', border: '2px solid'}

const setup = async (props, shown) => {
    log.length = 0
    const view = await render(ui({plugins: PLUGINS, style: box, in: shown, ...props}))
    const el = () => view.host.firstElementChild
    return {...view, el, toggle: next => view.rerender(ui({plugins: PLUGINS, style: box, in: next, ...props}))}
}

describe('Collapse plugins', () => {
    test('frame styles go into every keyframe of a plain collapse', async () => {
        const {el, toggle} = await setup({plugins: CLIP, style: undefined}, false)
        await toggle(true)
        const [from, to] = frames(el())
        expect(from).toMatchObject({height: '0px', overflow: 'clip'})
        expect(to).toMatchObject({height: '100px', overflow: 'clip'})
    })

    test('closed owns the hidden rest: no hold animation, the element stays mounted', async () => {
        const {el} = await setup({}, false)
        await settle()
        expect(el().getAnimations()).toEqual([])
        expect(el().style.maxHeight).toBe('30px')
        expect(size(el())).toBe(44)
    })

    test('enter animates from the measured closed box, keeps paddings and adds no edge frame', async () => {
        const calls = spies()
        const {el, toggle} = await setup(calls, false)
        log.length = 0
        await toggle(true)
        expect(log).toEqual([false, true, false])
        const keyframes = frames(el())
        expect(keyframes).toHaveLength(2)
        expect(keyframes[0]).toMatchObject({height: '44px', paddingTop: '5px', borderTopWidth: '2px', overflow: 'clip'})
        expect(keyframes[1]).toMatchObject({height: '114px', paddingTop: '5px', overflow: 'clip'})
        expect(el().style.maxHeight).toBe('')
        await finish(el())
        expect(calls.onEntered).toHaveBeenCalledOnce()
        expect(el().getAnimations()).toEqual([])
        expect(size(el())).toBe(114)
    })

    test('exit ends in the plugin closed state with no animation left and the element mounted', async () => {
        const calls = spies()
        const {el, toggle} = await setup(calls, true)
        const node = el()
        await toggle(false)
        expect(frames(node)[1]).toMatchObject({height: '44px'})
        expect(node.style.maxHeight).toBe('')
        await finish(node)
        expect(calls.onExited).toHaveBeenCalledOnce()
        expect(el()).toBe(node)
        expect(node.getAnimations()).toEqual([])
        expect(node.style.maxHeight).toBe('30px')
        expect(size(node)).toBe(44)
    })

    test('a closed box equal to the open one switches at once', async () => {
        const calls = spies()
        const {el, toggle} = await setup({...calls, children: <div style={{height: 20}}/>}, false)
        await toggle(true)
        expect(el().getAnimations()).toEqual([])
        expect(calls.onEntered).toHaveBeenCalledOnce()
        await toggle(false)
        expect(el().getAnimations()).toEqual([])
        expect(calls.onExited).toHaveBeenCalledOnce()
        expect(el().style.maxHeight).toBe('30px')
    })

    test('an explicit unmountOnExit wins over the plugin default', async () => {
        const {host, el, toggle} = await setup({unmountOnExit: true}, true)
        await toggle(false)
        await finish(el())
        expect(host.innerHTML).toBe('')
    })

    test('observe gets the element and its cleanup runs on unmount', async () => {
        const stop = vi.fn()
        const observe = vi.fn(() => stop)
        const view = await render(ui({plugins: [{observe}], in: true, children: block}))
        expect(observe).toHaveBeenCalledWith(view.host.firstElementChild)
        await view.unmount()
        expect(stop).toHaveBeenCalledOnce()
    })
})
