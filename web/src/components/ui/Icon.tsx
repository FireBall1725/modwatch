// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { SVGProps } from 'react'
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub'
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons/faArrowRight'
import { faArrowTrendDown } from '@fortawesome/free-solid-svg-icons/faArrowTrendDown'
import { faArrowTrendUp } from '@fortawesome/free-solid-svg-icons/faArrowTrendUp'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons/faArrowUpRightFromSquare'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons/faArrowsRotate'
import { faBan } from '@fortawesome/free-solid-svg-icons/faBan'
import { faBars } from '@fortawesome/free-solid-svg-icons/faBars'
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt'
import { faBox } from '@fortawesome/free-solid-svg-icons/faBox'
import { faBoxArchive } from '@fortawesome/free-solid-svg-icons/faBoxArchive'
import { faBug } from '@fortawesome/free-solid-svg-icons/faBug'
import { faCalendar } from '@fortawesome/free-solid-svg-icons/faCalendar'
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight'
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp'
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck'
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons/faCircleExclamation'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo'
import { faCircleMinus } from '@fortawesome/free-solid-svg-icons/faCircleMinus'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons/faCircleQuestion'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark'
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock'
import { faCube } from '@fortawesome/free-solid-svg-icons/faCube'
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload'
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye'
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash'
import { faFile } from '@fortawesome/free-solid-svg-icons/faFile'
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter'
import { faHeart } from '@fortawesome/free-solid-svg-icons/faHeart'
import { faHourglassHalf } from '@fortawesome/free-solid-svg-icons/faHourglassHalf'
import { faHouse } from '@fortawesome/free-solid-svg-icons/faHouse'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons/faLayerGroup'
import { faLink } from '@fortawesome/free-solid-svg-icons/faLink'
import { faLinkSlash } from '@fortawesome/free-solid-svg-icons/faLinkSlash'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlass'
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus'
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons/faPenToSquare'
import { faPencil } from '@fortawesome/free-solid-svg-icons/faPencil'
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus'
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece'
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders'
import { faSort } from '@fortawesome/free-solid-svg-icons/faSort'
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar'
import { faTableCellsLarge } from '@fortawesome/free-solid-svg-icons/faTableCellsLarge'
import { faTableColumns } from '@fortawesome/free-solid-svg-icons/faTableColumns'
import { faTag } from '@fortawesome/free-solid-svg-icons/faTag'
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons/faWandMagicSparkles'
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark'

// Font Awesome Free 7 (Solid, plus the GitHub brand mark), https://fontawesome.com. Icons are CC BY 4.0, see NOTICE.md.
// Each icon is imported by itself so the bundle only carries the ones listed here.
const ICONS = {
  // navigation
  overview: faTableCellsLarge,
  mods: faCube,
  downloads: faDownload,
  versions: faLayerGroup,
  issues: faCircleExclamation,
  releases: faTag,
  settings: faSliders,

  // review status
  approved: faCircleCheck,
  in_review: faHourglassHalf,
  changes_required: faPenToSquare,
  rejected: faCircleXmark,
  draft: faFile,
  unlisted: faEyeSlash,
  archived: faBoxArchive,
  inactive: faCircleMinus,
  unknown: faCircleQuestion,

  // severity and issue kinds
  problem: faBan,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  bug: faBug,
  crash: faBolt,
  enhancement: faStar,
  compatibility: faPuzzlePiece,
  question: faCircleQuestion,

  // generic
  check: faCheck,
  close: faXmark,
  plus: faPlus,
  minus: faMinus,
  search: faMagnifyingGlass,
  menu: faBars,
  chevron_down: faChevronDown,
  chevron_up: faChevronUp,
  chevron_left: faChevronLeft,
  chevron_right: faChevronRight,
  arrow_up: faArrowUp,
  arrow_down: faArrowDown,
  arrow_right: faArrowRight,
  sort: faSort,
  external: faArrowUpRightFromSquare,
  refresh: faArrowsRotate,
  link: faLink,
  unlink: faLinkSlash,
  github: faGithub,
  filter: faFilter,
  calendar: faCalendar,
  trend_up: faArrowTrendUp,
  trend_down: faArrowTrendDown,
  clock: faClock,
  package: faBox,
  heart: faHeart,
  eye: faEye,
  trash: faTrash,
  edit: faPencil,
  wand: faWandMagicSparkles,
  panel: faTableColumns,
  home: faHouse,
  dot: faCircle,
} as const

export type IconName = keyof typeof ICONS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Pixel size, square. Default 18. */
  size?: number
  /** Accessible name. Leave out for a decorative icon next to text; it is hidden from screen readers then. */
  title?: string
}

/** Inline Font Awesome Free icon. Colour follows currentColor. Give it a title unless it is decorative. */
export default function Icon({ name, size = 18, title, className, ...rest }: IconProps) {
  const [width, height, , , path] = ICONS[name].icon
  const d = typeof path === 'string' ? path : path.join('')
  // A square box with the glyph centred in it, so labels line up whatever the glyph's own width.
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      className={['shrink-0', className].filter(Boolean).join(' ')}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}
