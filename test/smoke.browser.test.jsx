import {expect, test} from 'vitest'
import {act} from 'react'
import {createRoot} from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('runs in a real browser with the Web Animations API', () => {
    expect(typeof document.body.animate).toBe('function')
})

test('renders a React element into the DOM', async () => {
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)
    await act(() => root.render(<p className='smoke'>hello</p>))
    expect(host.querySelector('.smoke').textContent).toBe('hello')
    await act(() => root.unmount())
    host.remove()
})
