// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { SVGProps } from 'react'

// One stroke family: 24 px grid, 1.75 stroke, round caps and joins. Every path is drawn by hand for this app.
const PATHS = {
  // navigation
  overview: 'M4 4h6.5v7.5H4zM13.5 4H20v4.5h-6.5zM13.5 11.5H20V20h-6.5zM4 14.5h6.5V20H4z',
  mods: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  downloads: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
  versions: 'M12 3.5l8.5 4.5L12 12.5 3.5 8zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
  issues: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5v5.5M12 16.2v.1',
  releases: 'M4 12.2V5.5A1.5 1.5 0 015.5 4h6.7a1.5 1.5 0 011.06.44l6.3 6.3a1.5 1.5 0 010 2.12l-6.7 6.7a1.5 1.5 0 01-2.12 0l-6.3-6.3A1.5 1.5 0 014 12.2zM8.5 8.5v.1',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',

  // review status
  approved: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM8 12.3l2.8 2.8L16.3 9.5',
  in_review: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5V12l3 2',
  changes_required: 'M4 20l1-4L16.5 4.5a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L8 19zM14.5 6.5l3 3',
  rejected: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9 9l6 6M15 9l-6 6',
  draft: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 13h6M9 16.5h4',
  unlisted: 'M3.5 12s3.2-6 8.5-6c1.3 0 2.5.3 3.5.8M20.5 12s-1 1.9-2.9 3.5M4 4l16 16M9.9 9.9a3 3 0 004.2 4.2',
  archived: 'M4 5.5h16v4H4zM5.5 9.5V19h13V9.5M10 13h4',
  inactive: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM8 12h8',
  unknown: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.1M12 16.7v.1',

  // severity and issue kinds
  problem: 'M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3zM12 8v5M12 16v.1',
  warning: 'M12 4l9 15.5H3zM12 10v4.2M12 17v.1',
  info: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 11v5.5M12 7.8v.1',
  bug: 'M9 7a3 3 0 016 0v1H9zM7.5 8.5h9V14a4.5 4.5 0 01-9 0zM12 12v7M4 10.5l3.5 1.5M20 10.5L16.5 12M4 17l3.5-1.5M20 17l-3.5-1.5M9 4L7.5 2.5M15 4l1.5-1.5',
  crash: 'M13.5 3L5 13.5h6.2L10.5 21 19 10.5h-6.2z',
  enhancement: 'M12 3.5l2.2 5.3 5.8.5-4.4 3.8 1.4 5.7-5-3-5 3 1.4-5.7L4 9.3l5.8-.5z',
  compatibility: 'M9.5 14.5l-2 2a3 3 0 01-4.2-4.2l3-3a3 3 0 014.2 0M14.5 9.5l2-2a3 3 0 014.2 4.2l-3 3a3 3 0 01-4.2 0',
  question: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.1M12 16.7v.1',

  // generic
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM15.5 15.5L20 20',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevron_down: 'M6 9.5l6 6 6-6',
  chevron_up: 'M6 14.5l6-6 6 6',
  chevron_left: 'M14.5 6l-6 6 6 6',
  chevron_right: 'M9.5 6l6 6-6 6',
  arrow_up: 'M12 19V5M6 11l6-6 6 6',
  arrow_down: 'M12 5v14M6 13l6 6 6-6',
  arrow_right: 'M5 12h14M13 6l6 6-6 6',
  sort: 'M8 5v14M4.5 15.5L8 19l3.5-3.5M16 19V5M12.5 8.5L16 5l3.5 3.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10',
  refresh: 'M19.5 12a7.5 7.5 0 01-13.1 5M4.5 12a7.5 7.5 0 0113.1-5M18 3v4.5h-4.5M6 21v-4.5h4.5',
  link: 'M9.5 14.5l5-5M10.5 7l1.2-1.2a4 4 0 015.7 5.7L16.2 12.7M13.5 17l-1.2 1.2a4 4 0 01-5.7-5.7L7.8 11.3',
  unlink: 'M10.5 7l1.2-1.2a4 4 0 015.7 5.7L16.2 12.7M13.5 17l-1.2 1.2a4 4 0 01-5.7-5.7L7.8 11.3M4 4l16 16',
  github: 'M12 3.5a8.5 8.5 0 00-2.7 16.6c.4.1.6-.2.6-.4v-1.5c-2.4.5-2.9-1-2.9-1-.4-1-1-1.3-1-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-1.9-.2-3.9-1-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.3 0 0 .7-.2 2.3.9a8 8 0 014.2 0c1.6-1.1 2.3-.9 2.3-.9.5 1.2.2 2.1.1 2.3.5.6.9 1.4.9 2.3 0 3.2-2 4-3.9 4.2.3.3.6.8.6 1.6v2.3c0 .2.2.5.6.4A8.5 8.5 0 0012 3.5z',
  filter: 'M4 5.5h16l-6 7.5v5.5l-4 2V13z',
  calendar: 'M5 5.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V6.5a1 1 0 011-1zM4 10h16M8 3.5v4M16 3.5v4',
  trend_up: 'M3.5 17l6-6 4 4 7-7.5M15 7.5h5.5V13',
  trend_down: 'M3.5 7l6 6 4-4 7 7.5M15 16.5h5.5V11',
  clock: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5V12l3 2',
  package: 'M3.5 8L12 3.5 20.5 8v8L12 20.5 3.5 16zM3.5 8L12 12.5 20.5 8M12 12.5v8M7.7 5.8l8.6 4.4',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  eye: 'M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12zM12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5',
  edit: 'M4 20l1-4L16.5 4.5a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L8 19zM14.5 6.5l3 3',
  wand: 'M5 19L15 9M14 4l1 2.2L17.2 7 15 8l-1 2.2L13 8l-2.2-1L13 6zM19 12l.6 1.4 1.4.6-1.4.6L19 16l-.6-1.4-1.4-.6 1.4-.6z',
  panel: 'M4 5h16v14H4zM9.5 5v14',
  home: 'M4 11l8-6.5 8 6.5M6 9.8V19.5h12V9.8',
  dot: 'M12 12v.01',
} as const

export type IconName = keyof typeof PATHS


interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Pixel size, square. Default 18. */
  size?: number
  /** Accessible name. Leave out for a decorative icon next to text; it is hidden from screen readers then. */
  title?: string
}

/** Inline SVG icon. Colour follows currentColor. Props: name, size (px), title (accessible name; omit when decorative). */
export default function Icon({ name, size = 18, title, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'github' ? 'currentColor' : 'none'}
      stroke={name === 'github' ? 'none' : 'currentColor'}
      strokeWidth={name === 'dot' ? 5 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['shrink-0', className].filter(Boolean).join(' ')}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
