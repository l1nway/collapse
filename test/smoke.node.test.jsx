import {expect, test} from 'vitest'
import {renderToString} from 'react-dom/server'

test('renderToString works in node', () => {
    expect(typeof window).toBe('undefined')
    expect(renderToString(<div/>)).toBe('<div></div>')
})
