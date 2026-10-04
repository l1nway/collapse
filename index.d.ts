import type {ComponentPropsWithRef, CSSProperties, ElementType, ReactElement, ReactNode, Ref} from 'react'

export type Plugin = {
    unmountOnExit?: boolean
    frame?: CSSProperties
    closed?: (el: HTMLElement, on: boolean) => void
    observe?: (el: HTMLElement) => void | (() => void)
}

type OwnProps<T extends ElementType> = {
    as?: T
    in?: unknown
    axis?: 'x' | 'y'
    fade?: boolean
    plugins?: readonly Plugin[]
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

export type ClampOptions = {
    lines?: number
    onOverflow?: (overflow: boolean) => void
}

export declare function createClamp(options?: ClampOptions): Plugin

export declare const clamp: Plugin
