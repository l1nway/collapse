import {StrictMode, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Collapse, Presence} from '../src/index.js'

const Toggle = ({value, set, label = 'toggle'}) => <button type='button' onClick={() => set(!value)}>{label}: {String(value)}</button>

function Basic({duration}) {
    const [open, setOpen] = useState(false)
    return <>
        <Toggle value={open} set={setOpen}/>
        <Collapse in={open} duration={duration} className='box'>
            <p>Height, padding, border and margin animate together.</p>
            <p>Click the toggle mid-way to reverse.</p>
        </Collapse>
        <p className='below'>content below must move smoothly</p>
    </>
}

function Horizontal({duration}) {
    const [open, setOpen] = useState(true)
    return <>
        <Toggle value={open} set={setOpen}/>
        <p className='row'>
            Saving<Collapse as='span' axis='x' fade in={open} duration={duration} className='chip'>in progress</Collapse>done
        </p>
    </>
}

function Kept({duration}) {
    const [list, setList] = useState(['first', 'second'])
    return <>
        <button type='button' onClick={() => setList(list.length ? [] : ['first', 'second'])}>{list.length ? 'empty the list' : 'refill'}</button>
        <Collapse in={list.length > 0} duration={duration} className='box'>
            {list.length ? list.map(item => <p key={item}>{item}</p>) : <p>EMPTY: must never be visible</p>}
        </Collapse>
    </>
}

function Mounted({duration}) {
    const [open, setOpen] = useState(false)
    return <>
        <Toggle value={open} set={setOpen}/>
        <Collapse in={open} unmountOnExit={false} inert={!open} aria-hidden={!open} duration={duration} className='box'>
            <p>Stays in the DOM while closed, held at 0.</p>
            <button type='button'>not focusable while closed</button>
        </Collapse>
    </>
}

function Margins({duration}) {
    const [open, setOpen] = useState(false)
    return <>
        <Toggle value={open} set={setOpen}/>
        <Collapse in={open} duration={duration} className='plain'>
            <p className='margin'>Last child has margin-bottom: 2em; no jump, the green never covers the margin.</p>
        </Collapse>
        <p className='below'>content below</p>
    </>
}

function Focus({duration}) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    return <>
        <Toggle value={open} set={setOpen}/>
        <button type='button' onClick={() => ref.current?.focus()}>focus panel</button>
        <Collapse ref={ref} tabIndex={-1} in={open} duration={duration} onEntered={() => ref.current?.focus()} className='box'>
            <p>Focused through the ref after it opened.</p>
        </Collapse>
    </>
}

function List({duration}) {
    const [items, setItems] = useState([1, 2, 3])
    const next = useRef(4)
    const add = () => setItems([...items.slice(0, 1), next.current++, ...items.slice(1)])
    const remove = id => setItems(items.filter(item => item !== id))
    return <>
        <button type='button' onClick={add}>add at 2nd place</button>
        <Presence>
            {items.map(id => (
                <Collapse key={id} duration={duration} className='item'>
                    item {id} <button type='button' onClick={() => remove(id)}>remove</button>
                </Collapse>
            ))}
        </Presence>
    </>
}

function Swap({duration}) {
    const [step, setStep] = useState(0)
    const views = ['Short.', 'A much longer view.\nIt has a second line.', 'Medium view text.']
    return <>
        <button type='button' onClick={() => setStep((step + 1) % views.length)}>next view (wait)</button>
        <Presence wait>
            <Collapse key={step} className='box swap'>{views[step]}</Collapse>
        </Presence>
        <p className='below'>{duration} ms default is halved per side: out, then in</p>
    </>
}

function Nested({duration}) {
    const [outer, setOuter] = useState(false)
    const [inner, setInner] = useState(false)
    return <>
        <Toggle value={outer} set={setOuter} label='outer'/>
        <Toggle value={inner} set={setInner} label='inner'/>
        <Collapse in={outer} duration={duration} className='box'>
            <p>Outer</p>
            <Collapse in={inner} duration={duration} className='box'><p>Inner</p></Collapse>
        </Collapse>
    </>
}

const cards = [
    ['Enter, exit, reverse', Basic],
    ['axis x + fade, inline', Horizontal],
    ['Frozen children while leaving', Kept],
    ['unmountOnExit={false}', Mounted],
    ['Child margins under the clip', Margins],
    ['ref + focus', Focus],
    ['Presence list', List],
    ['Presence wait', Swap],
    ['Nested', Nested]
]

function App() {
    const [duration, setDuration] = useState(600)
    return (
        <main>
            <h1>collapse playground</h1>
            <label>duration {duration} ms <input type='range' min='0' max='3000' step='100' value={duration} onChange={e => setDuration(+e.target.value)}/></label>
            {cards.map(([title, Demo]) => (
                <section key={title} className='card'>
                    <h2>{title}</h2>
                    <Demo duration={duration}/>
                </section>
            ))}
        </main>
    )
}

createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>)
