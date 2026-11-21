// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import DeltaText from './DeltaText'
import ModIcon from './ModIcon'
import NewTabCue from './NewTabCue'
import PartialCountsNote from './PartialCountsNote'
import PlatformAbsent from './PlatformAbsent'
import PlatformBadge from './PlatformBadge'
import Tooltip from './Tooltip'
import TimeSeriesChart from '../charts/TimeSeriesChart'

describe('DeltaText', () => {
  it('renders the same placeholder with hidden text on every use, suffix kept', () => {
    const { container } = render(
      <>
        <DeltaText value={null} />
        <DeltaText value={undefined} suffix="24h" />
      </>,
    )
    expect(screen.getAllByText('Not available yet')).toHaveLength(2)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
    expect(container).toHaveTextContent('24h')
  })
})

describe('PlatformAbsent', () => {
  it('says Not on and the platform name', () => {
    render(<PlatformAbsent platform="modrinth" />)
    expect(screen.getByText('Not on Modrinth')).toBeInTheDocument()
  })
  it('PlatformBadge absent uses the same phrase', () => {
    render(<PlatformBadge platform="curseforge" absent />)
    expect(screen.getByText('Not on CurseForge')).toBeInTheDocument()
  })
})

describe('PartialCountsNote and NewTabCue', () => {
  it('shows the one-line note', () => {
    render(<PartialCountsNote />)
    expect(screen.getByText(/CurseForge counts each file on its own/)).toBeInTheDocument()
  })
  it('has the hidden new tab cue', () => {
    render(<NewTabCue />)
    expect(screen.getByText('(opens in a new tab)')).toHaveClass('sr-only')
  })
})

describe('ModIcon', () => {
  it('uses the monogram for an empty or blank URL', () => {
    const { container, rerender } = render(<ModIcon src="" name="Create Turbolifts" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('CT')
    rerender(<ModIcon src="   " name="Create Turbolifts" />)
    expect(container.querySelector('img')).toBeNull()
  })
  it('falls back to the monogram when the image fails', () => {
    const { container } = render(<ModIcon src="https://example.invalid/x.png" name="Graves" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img as HTMLImageElement)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('G')
  })
})

describe('Tooltip', () => {
  it('is tied to its trigger, opens on focus and closes on Escape', () => {
    render(
      <Tooltip content="More detail">
        <button type="button">Trigger</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button', { name: 'Trigger' })
    const tip = screen.getByRole('tooltip')
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id)
    const wrap = tip.parentElement as HTMLElement
    expect(wrap).toHaveClass('opacity-0')
    fireEvent.focus(btn)
    expect(wrap).toHaveClass('opacity-100')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(wrap).toHaveClass('opacity-0')
  })
  it('stays open while the pointer is over it', () => {
    render(
      <Tooltip content="More detail">
        <button type="button">Trigger</button>
      </Tooltip>,
    )
    const tip = screen.getByRole('tooltip')
    const wrap = tip.parentElement as HTMLElement
    fireEvent.pointerEnter(wrap.parentElement as HTMLElement)
    expect(wrap).toHaveClass('opacity-100')
  })
  it('keeps an existing description on the trigger', () => {
    render(
      <Tooltip content="x">
        <button type="button" aria-describedby="other">
          T
        </button>
      </Tooltip>,
    )
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toMatch(/^other /)
  })
})

describe('TimeSeriesChart', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })
  it('keeps the hidden data table inside a clipped box so it cannot widen the page', () => {
    const { container } = render(
      <TimeSeriesChart x={['2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z']} series={[{ key: 'a', label: 'A', color: 'red', values: [1, 2] }]} caption="Test" />,
    )
    const table = container.querySelector('table') as HTMLElement
    expect(table.parentElement).toHaveClass('sr-only')
    expect(container.querySelector('figure')).toHaveClass('relative')
  })
})
