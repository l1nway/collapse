import {Children, isValidElement, useCallback, useMemo, useState} from 'react'
import {PresenceContext} from './collapse.jsx'

const PresenceChild = ({id, present, appear, swap, onExited, children}) => {
    const value = useMemo(() => ({present, appear, swap, onExited: () => onExited(id)}), [id, present, appear, swap, onExited])
    return <PresenceContext value={value}>{children}</PresenceContext>
}

// [DOC: presence-order]
const sync = (list, children, wait, appear = true) => {
    const next = Children.toArray(children).filter(isValidElement)
    const keys = new Set(next.map(el => el.key))
    const known = new Map(list.map(item => [item.key, item]))
    const items = next.map(el => ({key: el.key, el, present: true, appear: known.get(el.key)?.appear ?? appear}))
    // leavers follow their old neighbour
    let at = 0
    const left = new Set()
    list.forEach(item => {
        if (keys.has(item.key)) {
            if (item.present) at = items.findIndex(next => next.key === item.key) + 1
        } else if (!item.pending) {
            const leaver = item.present ? {...item, present: false, swap: false} : item
            if (item.present) left.add(leaver)
            items.splice(at++, 0, leaver)
        }
    })
    // [DOC: presence-wait]
    const fresh = item => item.present && (known.get(item.key)?.pending ?? !known.has(item.key))
    const leaving = left.size > 0 || list.some(item => item.pending)
    if (!wait || !leaving || !items.some(item => !item.present) || !items.some(fresh)) return {children, list: items}
    const mark = item => left.has(item) ? {...item, swap: true} : fresh(item) ? {...item, pending: true, swap: true} : item
    return {children, list: items.map(mark)}
}

// show waiting items
const release = list => list.some(item => !item.present)
    ? list
    : list.map(item => item.pending ? {...item, pending: false} : item)

// [DOC: presence]
export function Presence({children, wait = false}) {
    const [state, setState] = useState(() => sync([], children, wait, false))
    if (state.children !== children) setState(sync(state.list, children, wait))

    const remove = useCallback(key => setState(prev => prev.list.some(item => item.key === key && !item.present)
        ? {...prev, list: release(prev.list.filter(item => item.key !== key))}
        : prev
    ), [])

    return state.list.map(({key, el, present, appear, pending, swap = false}) => !pending &&
        <PresenceChild key={key} id={key} present={present} appear={appear} swap={swap} onExited={remove}>{el}</PresenceChild>
    )
}
