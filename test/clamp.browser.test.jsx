import {afterEach, describe, expect, test, vi} from 'vitest'
import {Collapse} from '../src/collapse.jsx'
import {clamp, createClamp} from '../src/clamp.js'
import {finish, frames, near, render, seek, settle, size, spies} from './helpers.jsx'

const LONG = 'word '.repeat(80)
const LINE = 20
const text = {margin: 0, font: '16px/20px sans-serif'}
const CLAMP = [clamp]

const Card = ({width = 200, float, ...props}) => (
    <div style={{width}}>
        {float && <span style={{float: 'left', width: 60, height: LINE * 2}}/>}
        <Collapse as='p' plugins={CLAMP} duration={1000} easing='linear' style={text} {...props}/>
    </div>
)

afterEach(() => {vi.restoreAllMocks()})

const setup = async (props, shown = false) => {
    const view = await render(<Card in={shown} {...props}/>)
    await settle()
    return {...view, el: () => view.host.querySelector('p'), toggle: next => view.rerender(<Card in={next} {...props}/>)}
}

describe('clamp at rest', () => {
    test('long text renders as a p clamped to 3 lines and flagged', async () => {
        const {el} = await setup({children: LONG})
        expect(el().tagName).toBe('P')
        expect(size(el())).toBe(LINE * 3)
        expect(el().hasAttribute('data-overflow')).toBe(true)
        expect(el().getAnimations()).toEqual([])
    })

    test('short text keeps its size, is not flagged and toggles without motion', async () => {
        const calls = spies()
        const {el, toggle} = await setup({children: 'short', ...calls})
        expect(size(el())).toBe(LINE)
        expect(el().hasAttribute('data-overflow')).toBe(false)
        await toggle(true)
        expect(el().getAnimations()).toEqual([])
        expect(calls.onEntered).toHaveBeenCalledOnce()
        expect(size(el())).toBe(LINE)
    })

    test('createClamp takes the line count', async () => {
        const {el} = await setup({children: LONG, plugins: [createClamp({lines: 2})]})
        expect(size(el())).toBe(LINE * 2)
    })

    test('a width change while closed re-measures the flag and reports it', async () => {
        const onOverflow = vi.fn()
        const plugins = [createClamp({onOverflow})]
        const view = await setup({children: 'word '.repeat(30), plugins})
        expect(onOverflow).toHaveBeenLastCalledWith(true)
        await view.rerender(<Card in={false} width={2000} plugins={plugins}>{'word '.repeat(30)}</Card>)
        await settle()
        expect(view.el().hasAttribute('data-overflow')).toBe(false)
        expect(onOverflow).toHaveBeenLastCalledWith(false)
    })

    test('text changing across the line limit while closed updates the flag with no resize', async () => {
        const view = await setup({children: 'word '.repeat(12)})
        expect(view.el().hasAttribute('data-overflow')).toBe(false)
        await view.rerender(<Card in={false}>{'word '.repeat(30)}</Card>)
        await settle()
        expect(view.el().hasAttribute('data-overflow')).toBe(true)
        expect(size(view.el())).toBe(LINE * 3)
        await view.rerender(<Card in={false}>{'word '.repeat(12)}</Card>)
        await settle()
        expect(view.el().hasAttribute('data-overflow')).toBe(false)
    })
})

describe('clamp transitions', () => {
    test('enter animates from 3 lines to the full height under overflow clip and leaves no trace', async () => {
        const calls = spies()
        const {el, toggle} = await setup({children: LONG, ...calls})
        await toggle(true)
        const [from, to] = frames(el())
        const full = parseFloat(to.height)
        expect(full).toBeGreaterThan(LINE * 3)
        expect(from).toMatchObject({height: LINE * 3 + 'px', overflow: 'clip'})
        expect(to.overflow).toBe('clip')
        seek(el(), 500)
        near(size(el()), (LINE * 3 + full) / 2)
        await finish(el())
        expect(calls.onEntered).toHaveBeenCalledOnce()
        expect(el().getAnimations()).toEqual([])
        expect(el().style.maxHeight).toBe('')
        near(size(el()), full)
    })

    test('exit clamps again only at the end and keeps the element', async () => {
        const calls = spies()
        const {el, toggle} = await setup({children: LONG, ...calls}, true)
        const node = el()
        await toggle(false)
        expect(frames(node)[1]).toMatchObject({height: LINE * 3 + 'px'})
        expect(node.style.maxHeight).toBe('')
        await finish(node)
        expect(calls.onExited).toHaveBeenCalledOnce()
        expect(el()).toBe(node)
        expect(node.getAnimations()).toEqual([])
        expect(node.style.maxHeight).toBe('3lh')
        expect(size(node)).toBe(LINE * 3)
    })

    test('closing mid-enter reverses without a jump and ends clamped', async () => {
        const {el, toggle} = await setup({children: LONG})
        await toggle(true)
        const node = el()
        const [animation] = node.getAnimations()
        seek(node, 400)
        const before = size(node)
        const toggled = toggle(false)
        near(size(node), before)
        await toggled
        expect(node.getAnimations()).toEqual([animation])
        await finish(node)
        expect(node.style.maxHeight).toBe('3lh')
        expect(size(node)).toBe(LINE * 3)
    })

    test('text wraps around a float at rest and while animating: no formatting context', async () => {
        const {el, host, toggle} = await setup({children: LONG, float: true})
        const left = host.firstElementChild.getBoundingClientRect().left
        expect(el().getBoundingClientRect().left).toBe(left)
        await toggle(true)
        seek(el(), 500)
        expect(el().getBoundingClientRect().left).toBe(left)
    })

    test('reduced motion still switches the clamp both ways', async () => {
        vi.spyOn(window, 'matchMedia').mockImplementation(media => ({media, matches: media.includes('reduce')}))
        const {el, toggle} = await setup({children: LONG})
        await toggle(true)
        await settle()
        expect(el().getAnimations()).toEqual([])
        expect(size(el())).toBeGreaterThan(LINE * 3)
        await toggle(false)
        await settle()
        expect(el().style.maxHeight).toBe('3lh')
        expect(size(el())).toBe(LINE * 3)
    })
})
