// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// The colour themes. Each is the handful of colours its own palette is known for. build.ts derives the rest of the
// design tokens from them and nudges any text colour that would not read, so every theme keeps the contrast the
// default one has. Run `npm run themes` after changing this file.

export interface Palette {
  id: string
  name: string
  scheme: 'dark' | 'light'
  /** Page background, then cards, then inset areas, then raised areas. */
  ground: string
  surface: string
  sunk: string
  raised: string
  line: string
  /** Main text and secondary text. */
  ink: string
  muted: string
  accent: string
  red: string
  green: string
  yellow: string
  blue: string
  purple: string
  cyan: string
  orange: string
  pink: string
}

/** The theme the app shipped with. Its values live in index.css, so it has no override block. */
export const DEFAULT_THEME = 'midnight-orchid'

export const PALETTES: Palette[] = [
  {
    id: 'midnight-orchid', name: 'Midnight Orchid', scheme: 'dark',
    ground: '#0f0d12', surface: '#17141c', sunk: '#1e1a25', raised: '#241f2d', line: '#2c2735',
    ink: '#ece8f1', muted: '#a8a1b4', accent: '#ff69b4',
    red: '#ff8a78', green: '#6fcb8c', yellow: '#e6b35a', blue: '#8fb7ff', purple: '#b79cff', cyan: '#6fd6c9', orange: '#f0806f', pink: '#d9a0c8',
  },
  {
    id: 'dracula', name: 'Dracula', scheme: 'dark',
    ground: '#1e1f29', surface: '#282a36', sunk: '#21222c', raised: '#343746', line: '#44475a',
    ink: '#f8f8f2', muted: '#a4acd0', accent: '#bd93f9',
    red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#8be9fd', purple: '#bd93f9', cyan: '#8be9fd', orange: '#ffb86c', pink: '#ff79c6',
  },
  {
    id: 'nord', name: 'Nord', scheme: 'dark',
    ground: '#2b303b', surface: '#2e3440', sunk: '#272c36', raised: '#3b4252', line: '#434c5e',
    ink: '#eceff4', muted: '#aab3c5', accent: '#88c0d0',
    red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', purple: '#b48ead', cyan: '#8fbcbb', orange: '#d08770', pink: '#b48ead',
  },
  {
    id: 'one-dark', name: 'One Dark', scheme: 'dark',
    ground: '#21252b', surface: '#282c34', sunk: '#1d2025', raised: '#2c313a', line: '#3e4451',
    ink: '#abb2bf', muted: '#8b93a1', accent: '#61afef',
    red: '#e06c75', green: '#98c379', yellow: '#e5c07b', blue: '#61afef', purple: '#c678dd', cyan: '#56b6c2', orange: '#d19a66', pink: '#c678dd',
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', scheme: 'dark',
    ground: '#16161e', surface: '#1a1b26', sunk: '#13131a', raised: '#292e42', line: '#32364a',
    ink: '#c0caf5', muted: '#8a93c0', accent: '#7aa2f7',
    red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', purple: '#bb9af7', cyan: '#7dcfff', orange: '#ff9e64', pink: '#bb9af7',
  },
  {
    id: 'catppuccin-mocha', name: 'Catppuccin Mocha', scheme: 'dark',
    ground: '#181825', surface: '#1e1e2e', sunk: '#11111b', raised: '#313244', line: '#45475a',
    ink: '#cdd6f4', muted: '#a6adc8', accent: '#cba6f7',
    red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa', purple: '#cba6f7', cyan: '#94e2d5', orange: '#fab387', pink: '#f5c2e7',
  },
  {
    id: 'gruvbox-dark', name: 'Gruvbox Dark', scheme: 'dark',
    ground: '#1d2021', surface: '#282828', sunk: '#1b1b1b', raised: '#3c3836', line: '#504945',
    ink: '#ebdbb2', muted: '#bdae93', accent: '#fe8019',
    red: '#fb4934', green: '#b8bb26', yellow: '#fabd2f', blue: '#83a598', purple: '#d3869b', cyan: '#8ec07c', orange: '#fe8019', pink: '#d3869b',
  },
  {
    id: 'solarized-dark', name: 'Solarized Dark', scheme: 'dark',
    ground: '#001f27', surface: '#002b36', sunk: '#00181f', raised: '#073642', line: '#0f4857',
    ink: '#eee8d5', muted: '#93a1a1', accent: '#268bd2',
    red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', purple: '#6c71c4', cyan: '#2aa198', orange: '#cb4b16', pink: '#d33682',
  },
  {
    id: 'monokai', name: 'Monokai', scheme: 'dark',
    ground: '#1e1f1c', surface: '#272822', sunk: '#191a17', raised: '#3e3d32', line: '#49483e',
    ink: '#f8f8f2', muted: '#b0ad98', accent: '#f92672',
    red: '#f92672', green: '#a6e22e', yellow: '#e6db74', blue: '#66d9ef', purple: '#ae81ff', cyan: '#66d9ef', orange: '#fd971f', pink: '#f92672',
  },
  {
    id: 'rose-pine', name: 'Rosé Pine', scheme: 'dark',
    ground: '#14121f', surface: '#191724', sunk: '#110f1a', raised: '#26233a', line: '#403d52',
    ink: '#e0def4', muted: '#908caa', accent: '#ebbcba',
    red: '#eb6f92', green: '#9ccfd8', yellow: '#f6c177', blue: '#31748f', purple: '#c4a7e7', cyan: '#9ccfd8', orange: '#f6c177', pink: '#ebbcba',
  },
  {
    id: 'github-dark', name: 'GitHub Dark', scheme: 'dark',
    ground: '#010409', surface: '#0d1117', sunk: '#010409', raised: '#21262d', line: '#30363d',
    ink: '#e6edf3', muted: '#8b949e', accent: '#58a6ff',
    red: '#f85149', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff', purple: '#bc8cff', cyan: '#56d4dd', orange: '#db6d28', pink: '#f778ba',
  },
  {
    id: 'github-light', name: 'GitHub Light', scheme: 'light',
    ground: '#f6f8fa', surface: '#ffffff', sunk: '#eaeef2', raised: '#ffffff', line: '#d0d7de',
    ink: '#1f2328', muted: '#656d76', accent: '#0969da',
    red: '#cf222e', green: '#1a7f37', yellow: '#9a6700', blue: '#0969da', purple: '#8250df', cyan: '#1b7c83', orange: '#bc4c00', pink: '#bf3989',
  },
  {
    id: 'solarized-light', name: 'Solarized Light', scheme: 'light',
    ground: '#fdf6e3', surface: '#fffbed', sunk: '#eee8d5', raised: '#fffdf5', line: '#e0dac5',
    ink: '#073642', muted: '#586e75', accent: '#268bd2',
    red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', purple: '#6c71c4', cyan: '#2aa198', orange: '#cb4b16', pink: '#d33682',
  },
  {
    id: 'gruvbox-light', name: 'Gruvbox Light', scheme: 'light',
    ground: '#f9f5d7', surface: '#fbf1c7', sunk: '#ebdbb2', raised: '#fdf6d3', line: '#d5c4a1',
    ink: '#3c3836', muted: '#665c54', accent: '#d65d0e',
    red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', purple: '#b16286', cyan: '#689d6a', orange: '#d65d0e', pink: '#b16286',
  },
  {
    id: 'catppuccin-latte', name: 'Catppuccin Latte', scheme: 'light',
    ground: '#e6e9ef', surface: '#eff1f5', sunk: '#dce0e8', raised: '#f6f7fa', line: '#ccd0da',
    ink: '#4c4f69', muted: '#6c6f85', accent: '#8839ef',
    red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5', purple: '#8839ef', cyan: '#179299', orange: '#fe640b', pink: '#ea76cb',
  },
]
