import type {ComponentPropsWithRef, ElementType, ReactElement, ReactNode, Ref} from 'react'

type OwnProps<T extends ElementType> = {
    as?: T
    in?: unknown
    axis?: 'x' | 'y'
    fade?: boolean
    unmountOnExit?: boolean
    duration?: number
    easing?: string
    ref?: Ref<HTMLElement>
    onEntered?: () => void
    onExited?: () => void
    children?: ReactNode
}

export type CollapseProps<T extends ElementType = 'div'> = OwnProps<T> & Omit<ComponentPropsWithRef<T>, keyof OwnProps<T>>

export declare function Collapse<T extends ElementType = 'div'>(props: CollapseProps<T>): ReactElement | null

export type PresenceProps = {
    children?: ReactNode
    wait?: boolean
}

export declare function Presence(props: PresenceProps): ReactNode
