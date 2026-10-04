import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, expect, vi} from 'vitest'
import {Collapse} from '../src/collapse.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted = new Set()

export const render = async ui => {
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)
    const view = {
        host,
        rerender: next => act(() => root.render(next)),
        unmount: async () => {
            await act(() => root.unmount())
            host.remove()
            mounted.delete(view)
        }
    }
    mounted.add(view)
    await act(() => root.render(ui))
    return view
}

afterEach(async () => {
    for (const view of [...mounted]) await view.unmount()
})

export const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()))

// let finish events and React updates land
export const settle = () => act(async () => {
    await frame()
    await frame()
})

export const finish = async el => {
    el.getAnimations().forEach(animation => animation.finish())
    await settle()
}

export const seek = (el, time) => el.getAnimations().forEach(animation => {animation.currentTime = time})

export const size = (el, axis = 'y') => el.getBoundingClientRect()[axis === 'y' ? 'height' : 'width']

export const near = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)

export const half = el => {
    seek(el, 500)
    return size(el)
}

export const block = <div style={{height: '100px'}}/>

export const ui = ({children = block, ...props}) => <Collapse duration={1000} easing='linear' {...props}>{children}</Collapse>

export const frames = el => el.getAnimations()[0].effect.getKeyframes()

export const spies = () => ({onEntered: vi.fn(), onExited: vi.fn()})

export const H = 20

export const item = (k, props) => <Collapse key={k} data-key={k} {...props}><div style={{height: H}}>{k}</div></Collapse>

export const order = view => [...view.host.querySelectorAll('[data-key]')].map(el => el.dataset.key)
