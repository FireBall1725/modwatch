// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import Icon, { type IconName } from './Icon'
import NewTabCue from './NewTabCue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover font-semibold shadow-e1',
  secondary: 'bg-raised text-ink border border-line-strong hover:border-ink/60 hover:bg-sunk',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'bg-bad-soft text-bad border border-bad/50 hover:bg-bad/20',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  /** Leading icon. */
  icon?: IconName
  /** Disables the button and shows a spinner. */
  loading?: boolean
  /** Renders a router link (or an anchor for http URLs) styled as a button. */
  href?: string
  /** Square icon-only button; children become the accessible label. */
  iconOnly?: boolean
  children: ReactNode
}

/** Button. Props: variant (primary, secondary, ghost, danger), size (sm, md), icon, loading, href, iconOnly. Targets are at least 40 px tall on md; use md on touch screens. */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  href,
  iconOnly = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const classes = cx(
    'inline-flex shrink-0 select-none items-center justify-center rounded-md whitespace-nowrap transition-colors duration-150',
    'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
    VARIANT[variant],
    SIZE[size],
    iconOnly && (size === 'sm' ? 'w-8 !px-0' : 'w-10 !px-0'),
    className,
  )
  const content = (
    <>
      {loading ? <Icon name="refresh" size={16} className="spin" /> : icon && <Icon name={icon} size={16} />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </>
  )
  if (href) {
    if (/^https?:/.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" className={classes}>
          {content}
          <NewTabCue />
        </a>
      )
    }
    return (
      <Link to={href} className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  )
}
