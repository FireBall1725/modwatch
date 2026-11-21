// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// @vitest-environment node

// The generated stylesheet must be the output of the palettes. Run `npm run themes` after changing palettes.ts.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { themeCss } from '../src/themes/build.ts'

it('themes.css is the output of palettes.ts', () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../src/themes/themes.css')
  expect(readFileSync(file, 'utf8')).toBe(themeCss())
})
