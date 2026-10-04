import {afterEach, describe, expect, test, vi} from 'vitest'
import {createRef} from 'react'
import {renderToReadableStream, renderToString} from 'react-dom/server'
import {prerender} from 'react-dom/static'
import {Collapse, Presence} from '../src/index.js'

const read = stream => new Response(stream).text()
const RENDERERS = {
    string: async ui => renderToString(ui),
    stream: async ui => read(await renderToReadableStream(ui)),
    prerender: async ui => read((await prerender(ui)).prelude)
}

const server = async ui => {
    const [first, ...rest] = await Promise.all(Object.values(RENDERERS).map(render => render(ui)))
    rest.forEach(html => expect(html).toBe(first))
    return first
}

describe('import', () => {
    afterEach(() => {
        delete globalThis.window
        delete globalThis.document
    })

    test('src/index.js imports in node without touching window or document', async () => {
        expect(typeof window).toBe('undefined')
        expect(typeof document).toBe('undefined')
        const touched = []
        const trap = name => Object.defineProperty(globalThis, name, {configurable: true, get: () => void touched.push(name)})
        trap('window')
        trap('document')
        vi.resetModules()
        const entry = await import('../src/index.js')
        expect(Object.keys(entry).sort()).toEqual(['Collapse', 'Presence'])
        expect(touched).toEqual([])
    })
})

describe('Collapse on the server', () => {
    test('shown renders the element with children and forwarded props, without style', async () => {
        const html = await server(<Collapse in id='box' className='panel' data-x='1' aria-hidden='false'><p>hi</p></Collapse>)
        expect(html).toBe('<div id="box" class="panel" data-x="1" aria-hidden="false"><p>hi</p></div>')
        expect(html).not.toContain('style')
    })

    test('hidden by default renders nothing', async () => {
        expect(await server(<Collapse id='box'><p>hi</p></Collapse>)).toBe('')
        expect(await server(<Collapse in={false} id='box'><p>hi</p></Collapse>)).toBe('')
    })

    test('hidden with unmountOnExit={false} renders the element unstyled on the server', async () => {
        const html = await server(<Collapse in={false} unmountOnExit={false} id='box'><p>hi</p></Collapse>)
        expect(html).toBe('<div id="box"><p>hi</p></div>')
        expect(html).not.toContain('style')
    })

    test('as renders the given tag', async () => {
        expect(await server(<Collapse in as='section' id='box'>hi</Collapse>)).toBe('<section id="box">hi</section>')
        expect(await server(<Collapse in as='li' axis='x' fade>hi</Collapse>)).toBe('<li>hi</li>')
    })

    test('a consumer style passes through untouched', async () => {
        expect(await server(<Collapse in style={{color: 'red'}}>hi</Collapse>)).toBe('<div style="color:red">hi</div>')
    })

    test('a ref prop does not throw and stays unset', async () => {
        const ref = createRef()
        const callback = vi.fn()
        expect(await server(<Collapse in ref={ref}>hi</Collapse>)).toBe('<div>hi</div>')
        expect(await server(<Collapse in ref={callback}>hi</Collapse>)).toBe('<div>hi</div>')
        expect(await server(<Collapse in={false} unmountOnExit={false} ref={ref}>hi</Collapse>)).toBe('<div>hi</div>')
        expect(ref.current).toBe(null)
        expect(callback).not.toHaveBeenCalled()
    })
})

describe('Presence on the server', () => {
    const list = wait => (
        <ul>
            <Presence wait={wait}>
                {['a', 'b', 'c'].map(key => <Collapse key={key} as='li' id={key}>{key}</Collapse>)}
                {null}
                {false}
            </Presence>
        </ul>
    )

    test('renders every keyed Collapse child', async () => {
        expect(await server(list(false))).toBe('<ul><li id="a">a</li><li id="b">b</li><li id="c">c</li></ul>')
    })

    test('wait does not change the server output', async () => {
        expect(await server(list(true))).toBe(await server(list(false)))
    })

    test('an explicit in on a child still wins', async () => {
        const html = await server(
            <Presence>
                <Collapse key='a' in={false}>a</Collapse>
                <Collapse key='b' in={false} unmountOnExit={false}>b</Collapse>
            </Presence>
        )
        expect(html).toBe('<div>b</div>')
    })
})
