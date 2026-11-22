// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

/// <reference types="vitest" />

// Vitest config. It reuses Vite's resolve and plugin pipeline, so tests see the same module graph as the production bundle.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // vite.config.ts injects this at build time; tests need their own value.
  define: { __APP_VERSION__: JSON.stringify('0.0.0-test') },
  test: {
    // jsdom gives us `document`, `window`, and friends for the hooks and
    // components that touch the DOM, which is most of the surface worth
    // testing here.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Anything ending in .test.ts(x) or .spec.ts(x). Excluding node_modules
    // and build output keeps a cold run fast.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    exclude: ['node_modules', 'dist', '.git'],
    css: false,
    // Stated rather than inherited so a future async component test doesn't
    // hit the 5s default as a surprise.
    testTimeout: 5_000,
  },
})
