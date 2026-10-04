import {describe, expect, test} from 'vitest'
import {Collapse} from '../src/collapse.jsx'
import {finish, frames, near, render, seek, settle, size, spies} from './helpers.jsx'

const X = ['width', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
const Y = ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
const zeros = props => Object.fromEntries(props.map(p => [p, '0px']))
const zero = {...zeros(Y), overflow: 'hidden', boxSizing: 'border-box', minHeight: '0px', maxHeight: 'none'}
const timed = {duration: 1000, easing: 'linear'}
const tall = <div style={{height: 100}}/>

const setup = async (ui, shown = false) => {
    const view = await render(ui(shown))
    return {...view, el: () => view.host.firstElementChild, toggle: next => view.rerender(ui(next))}
}

describe('Collapse frames', () => {
    test('axis x animates the horizontal box, lifts width limits and never touches height', async () => {
        const ui = shown => (
            <Collapse axis='x' in={shown} style={{display: 'inline-block', padding: '0 4px'}}>
                <div style={{width: 120, height: 20}}/>
            </Collapse>
        )
        const {el, toggle} = await setup(ui)
        await toggle(true)
        const [from, to] = frames(el())
        const lift = {overflow: 'hidden', boxSizing: 'border-box', minWidth: '0px', maxWidth: 'none'}
        expect(from).toMatchObject({...zeros(X), ...lift})
        expect(to).toMatchObject({...zeros(X), ...lift, width: '128px', paddingLeft: '4px', paddingRight: '4px'})
        for (const frame of [from, to]) [...Y, 'minHeight', 'maxHeight'].forEach(p => expect(frame).not.toHaveProperty(p))
    })

    test('fade animates opacity from 0 to the computed opacity', async () => {
        const {el, toggle} = await setup(shown => <Collapse fade in={shown} style={{opacity: 0.5}}>x</Collapse>)
        await toggle(true)
        expect(frames(el()).map(frame => String(frame.opacity))).toEqual(['0', '0.5'])
    })

    test('without fade opacity is not animated', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown}>x</Collapse>)
        await toggle(true)
        frames(el()).forEach(frame => expect(frame).not.toHaveProperty('opacity'))
    })

    test('padding, border and margin are 0 closed and while held, real when open', async () => {
        const style = {padding: 10, border: '2px solid', margin: 8}
        const {el, toggle} = await setup(shown => <Collapse in={shown} unmountOnExit={false} style={style}>{tall}</Collapse>)
        await settle()
        expect(size(el())).toBe(0)
        Y.forEach(p => expect(getComputedStyle(el())[p]).toBe('0px'))
        await toggle(true)
        const [from, , to] = frames(el())
        expect(from).toMatchObject(zero)
        expect(to).toMatchObject({
            height: '124px', paddingTop: '10px', paddingBottom: '10px', borderTopWidth: '2px', borderBottomWidth: '2px',
            marginTop: '8px', marginBottom: '8px'
        })
    })

    test('duration and easing props set the timing', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown} {...timed}>x</Collapse>)
        await toggle(true)
        expect(el().getAnimations()[0].effect.getTiming()).toMatchObject(timed)
    })

    test('timing defaults to 300ms ease', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown}>x</Collapse>)
        await toggle(true)
        expect(el().getAnimations()[0].effect.getTiming()).toMatchObject({duration: 300, easing: 'ease'})
    })
})

describe('Collapse layout', () => {
    test('a consumer min-height does not stop the collapse', async () => {
        const ui = shown => <Collapse in={shown} unmountOnExit={false} {...timed} style={{minHeight: 50}}>{tall}</Collapse>
        const {el, toggle} = await setup(ui)
        await settle()
        expect(size(el())).toBe(0)
        await toggle(true)
        await finish(el())
        expect(size(el())).toBe(100)
        await toggle(false)
        seek(el(), 999)
        near(size(el()), 0)
        await finish(el())
        expect(size(el())).toBe(0)
    })

    test('a consumer max-height caps the open size', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown} {...timed} style={{maxHeight: 40}}>{tall}</Collapse>)
        await toggle(true)
        expect(frames(el())[1]).toMatchObject({height: '40px', maxHeight: 'none'})
        seek(el(), 999)
        near(size(el()), 40)
        await finish(el())
        expect(size(el())).toBe(40)
    })

    test('a child margin collapsing through does not jump the next sibling', async () => {
        const ui = shown => (
            <div>
                <Collapse in={shown} {...timed}><p style={{margin: '0 0 16px', height: 20}}/></Collapse>
                <div style={{height: 10}}/>
            </div>
        )
        const {host, toggle} = await setup(ui)
        const top = el => el.getBoundingClientRect().top
        const sibling = () => top(host.firstElementChild.lastElementChild) - top(host)
        await toggle(true)
        const el = host.firstElementChild.firstElementChild
        seek(el, 999)
        const end = sibling()
        near(end, 36)
        await finish(el)
        near(sibling(), end)
        const rest = sibling()
        const toggled = toggle(false)
        near(sibling(), rest)
        await toggled
    })

    test('overflow is clipped only while animating', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown}>{tall}</Collapse>, true)
        expect(getComputedStyle(el()).overflowY).toBe('visible')
        await toggle(false)
        expect(getComputedStyle(el()).overflowY).toBe('hidden')
        await toggle(true)
        await finish(el())
        expect(getComputedStyle(el()).overflowY).toBe('visible')
    })

    test('a consumer overflow is restored after an animation', async () => {
        const {el, toggle} = await setup(shown => <Collapse in={shown} style={{overflow: 'auto'}}>{tall}</Collapse>, true)
        await toggle(false)
        expect(getComputedStyle(el()).overflowY).toBe('hidden')
        await toggle(true)
        await finish(el())
        expect(getComputedStyle(el()).overflowY).toBe('auto')
        expect(el().style.cssText).toBe('overflow: auto;')
    })

    test('consumer style and className survive animations with nothing animated left inline', async () => {
        const ui = shown => <Collapse in={shown} unmountOnExit={false} className='panel' style={{color: 'red'}}>x</Collapse>
        const {el, toggle} = await setup(ui, true)
        await toggle(false)
        await finish(el())
        await toggle(true)
        await finish(el())
        expect(el().className).toBe('panel')
        expect(el().style.cssText).toBe('color: red;')
    })
})

describe('Collapse props', () => {
    test.each([[0, 0], ['x', 1], [null, 0]])('in %j renders %i element', async (value, count) => {
        const {host} = await render(<Collapse in={value}>x</Collapse>)
        expect(host.childElementCount).toBe(count)
    })

    test('onEntered is not called when mounted already shown', async () => {
        const calls = spies()
        const {toggle} = await setup(shown => <Collapse in={shown} {...calls}>x</Collapse>, true)
        await settle()
        await toggle(true)
        await settle()
        expect(calls.onEntered).not.toHaveBeenCalled()
    })

    test('each transition calls its callback exactly once', async () => {
        const calls = spies()
        const {el, toggle} = await setup(shown => <Collapse in={shown} {...calls}>x</Collapse>)
        await toggle(true)
        await finish(el())
        await settle()
        await toggle(true)
        await settle()
        expect(calls.onEntered).toHaveBeenCalledTimes(1)
        await toggle(false)
        await finish(el())
        await settle()
        expect(calls.onExited).toHaveBeenCalledTimes(1)
        expect(calls.onEntered).toHaveBeenCalledTimes(1)
    })
})
