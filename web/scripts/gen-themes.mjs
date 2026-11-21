// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Writes src/themes/themes.css from src/themes/palettes.ts: `npm run themes`. Node reads the TypeScript directly.
import { writeFileSync } from 'node:fs'
import { themeCss } from '../src/themes/build.ts'

writeFileSync(new URL('../src/themes/themes.css', import.meta.url), themeCss())
console.log('wrote src/themes/themes.css')
