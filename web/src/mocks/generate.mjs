// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Writes the fixtures next to this file: `node src/mocks/generate.mjs` from web/. Seeded, so output is stable.
// Dates are relative to NOW below; mockApi.ts shifts them by whole days so they look current in the browser.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('./fixtures/', import.meta.url))
const NOW = Date.parse('2026-11-21T14:05:00.000Z')
const LAST_POLL = '2026-11-21T13:30:00.000Z'
const DAY = 86_400_000
const DAYS = 90

let seed = 1725
function rnd() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const iso = (ms) => new Date(ms).toISOString()
const daysAgo = (d, hour = 9, min = 12) => {
  const base = new Date(NOW - d * DAY)
  base.setUTCHours(hour, min, 0, 0)
  return base.toISOString()
}
const dayEnd = (k) => (k === 0 ? LAST_POLL : iso(Date.UTC(2026, 10, 21 - k, 23, 59, 59)))

function cmpMc(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
const sortMcDesc = (list) => [...new Set(list)].sort((a, b) => cmpMc(b, a))

// ---- Catalogue ---------------------------------------------------------------------------------

const NEO = ['neoforge']
const REPO = 'https://github.com/FireBall1725'

const MODS = [
  {
    slug: 'default-world-generator', name: 'Default World Generator', hue: 140,
    summary: 'Sets the world type, seed and generator settings for new worlds, so a pack ships its own defaults.',
    cf: { id: 227814, slug: 'default-world-generator', status: 'approved', raw: 'Approved', total: 1115528, since: 4100, gain: 0.012, thumbs: 412 },
    mr: { id: 'Kx9bQ2aE', slug: 'default-world-generator', status: 'unlisted', raw: 'unlisted', total: 5236, since: 1400, gain: 0.03, thumbs: 18 },
    label: 'default-world-generator', repo: 'default-world-generator',
    releases: [
      { v: '1.5.0', mc: ['1.18.2'], l: ['forge'], t: 'release', ago: 905 },
      { v: '1.4.2', mc: ['1.16.5'], l: ['forge'], t: 'release', ago: 1190 },
      { v: '1.3.1', mc: ['1.12.2'], l: ['forge'], t: 'release', ago: 1704 },
      { v: '1.2.0', mc: ['1.10.2'], l: ['forge'], t: 'release', ago: 2210 },
      { v: '1.0.4', mc: ['1.7.10'], l: ['forge'], t: 'release', ago: 3105 },
    ],
  },
  {
    slug: 'auto-gui-scale', name: 'Automatic Gui Scale', hue: 205,
    summary: 'Picks the GUI scale that fits your window, so menus stay readable on every monitor.',
    cf: { id: 689123, slug: 'automatic-gui-scale', status: 'approved', raw: 'Approved', total: 48310, since: 1100, gain: 0.07, thumbs: 96 },
    mr: { id: 'q3Zr7wLm', slug: 'ags', status: 'approved', raw: 'approved', total: 31942, since: 1090, gain: 0.07, thumbs: 61 },
    label: 'auto-gui-scale', repo: 'auto-gui-scale', manualLabel: true,
    releases: [
      { v: '3.2.1', mc: ['26.1'], l: ['neoforge', 'fabric'], t: 'release', ago: 38 },
      { v: '3.1.0', mc: ['1.21.11'], l: ['neoforge', 'fabric'], t: 'release', ago: 61 },
      { v: '3.0.2', mc: ['1.21.4', '1.21.1'], l: ['neoforge', 'fabric'], t: 'release', ago: 190 },
      { v: '2.4.0', mc: ['1.20.1'], l: ['forge', 'fabric'], t: 'release', ago: 520 },
      { v: '2.1.3', mc: ['1.19.2'], l: ['forge', 'fabric'], t: 'release', ago: 840 },
    ],
  },
  {
    slug: 'twitch-notifier', name: 'Twitch Notifier', hue: 270, icon: false,
    summary: 'Shows an in-game toast when a streamer you follow goes live.',
    cf: { id: 391775, slug: 'twitch-notifier', status: 'inactive', raw: 'Inactive', total: 22604, since: 1500, gain: 0.015, thumbs: 71 },
    mr: null,
    label: 'twitch-notifier', repo: 'twitch-notifier',
    releases: [
      { v: '1.3.0', mc: ['1.20.1'], l: ['forge'], t: 'release', ago: 640 },
      { v: '1.2.1', mc: ['1.19.2'], l: ['forge'], t: 'release', ago: 880 },
      { v: '1.0.0', mc: ['1.16.5'], l: ['forge'], t: 'release', ago: 1320 },
    ],
  },
  {
    slug: 'ae2-tech-addon', name: 'AE2 Tech Add-On', hue: 190,
    summary: 'Adds advanced multiblock machines to Applied Energistics 2, rewritten from the 1.7.10 original.',
    cf: { id: 905512, slug: 'ae2-tech-addon', status: 'approved', raw: 'Approved', total: 12418, since: 900, gain: 0.5, thumbs: 44 },
    mr: null,
    label: 'ae2-tech-addon', repo: 'ae2-tech-addon',
    releases: [
      { v: '2.0.0', mc: ['26.3'], l: NEO, t: 'beta', ago: 4 },
      { v: '2.0.0', mc: ['26.2'], l: NEO, t: 'beta', ago: 11 },
      { v: '2.0.0', mc: ['26.1'], l: NEO, t: 'beta', ago: 19 },
      { v: '2.0.0', mc: ['1.21.1'], l: NEO, t: 'beta', ago: 27 },
      { v: '1.0.7', mc: ['1.7.10'], l: ['forge'], t: 'release', ago: 2490 },
    ],
  },
  {
    slug: 'ftb-pax-timer', name: 'FTB Pax Timer', hue: 30,
    summary: 'A countdown and event timer overlay for FTB convention packs.',
    cf: { id: 560341, slug: 'ftb-pax-timer', status: 'approved', raw: 'Approved', total: 8950, since: 700, gain: 0.04, thumbs: 22 },
    mr: { id: 'T8vYc1nA', slug: 'ftb-pax-timer', status: 'archived', raw: 'archived', total: 411, since: 120, gain: 0.04, thumbs: 3 },
    label: 'ftb-pax-timer', repo: 'ftb-pax-timer',
    releases: [
      { v: '1.1.0', mc: ['1.18.2'], l: ['forge'], t: 'release', ago: 412 },
      { v: '1.0.0', mc: ['1.12.2'], l: ['forge'], t: 'release', ago: 1033 },
    ],
  },
  {
    slug: 'firecore', name: 'FireCore', hue: 335,
    summary: 'The shared library and GUI toolkit behind the FireBall1725 mods, plus the Benihime sword.',
    cf: { id: 1214770, slug: 'firecorelib', status: 'approved', raw: 'Approved', total: 5942, since: 0, gain: 1, thumbs: 31, pub: 74 },
    mr: { id: 'rF4dN6pS', slug: 'firecoremod', status: 'approved', raw: 'approved', total: 3217, since: 0, gain: 1, thumbs: 27, pub: 74 },
    label: 'firecore', repo: 'firecore', manual: true,
    releases: [
      { v: '0.9.2', mc: ['26.3'], l: NEO, t: 'beta', ago: 3 },
      { v: '0.9.2', mc: ['26.2'], l: NEO, t: 'beta', ago: 3 },
      { v: '0.9.1', mc: ['26.1'], l: NEO, t: 'beta', ago: 15 },
      { v: '0.9.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 33 },
      { v: '0.7.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 70 },
    ],
  },
  {
    slug: 'ae2-traffic-monitor', name: 'AE2 Traffic Monitor', hue: 175,
    summary: 'Shows how much item traffic each AE2 network cable carries, with a graph you can read at a glance.',
    cf: { id: 1187326, slug: 'ae2-traffic-monitor', status: 'approved', raw: 'Approved', total: 3426, since: 0, gain: 1, thumbs: 19, pub: 61 },
    mr: { id: 'mN2xK8vT', slug: 'ae2-traffic-monitor', status: 'approved', raw: 'approved', total: 2183, since: 0, gain: 1, thumbs: 14, pub: 61 },
    label: 'ae2-traffic-monitor', repo: 'ae2-traffic-monitor',
    releases: [
      { v: '1.2.0', mc: ['26.2'], l: NEO, t: 'beta', ago: 8 },
      { v: '1.2.0', mc: ['26.1'], l: NEO, t: 'beta', ago: 8 },
      { v: '1.1.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 29 },
      { v: '1.0.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 60 },
    ],
  },
  {
    slug: 'create-turbolifts', name: 'Create: Turbolifts', hue: 18,
    summary: 'Elevator cars for Create contraptions that ride sub-levels without a rail.',
    cf: { id: 1196044, slug: 'create-turbolifts', status: 'approved', raw: 'Approved', total: 1873, since: 0, gain: 1, thumbs: 12, pub: 52 },
    mr: { id: 'bV5hJ3cD', slug: 'create-turbolifts', status: 'approved', raw: 'approved', total: 1244, since: 0, gain: 1, thumbs: 9, pub: 52 },
    label: 'create-turbolifts', repo: 'create-turbolifts',
    releases: [
      { v: '0.6.0', mc: ['26.3'], l: NEO, t: 'beta', ago: 2 },
      { v: '0.6.0', mc: ['26.2'], l: NEO, t: 'beta', ago: 2 },
      { v: '0.5.1', mc: ['26.1'], l: NEO, t: 'beta', ago: 16 },
      { v: '0.5.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 21 },
      { v: '0.3.0', mc: ['1.21.1'], l: NEO, t: 'alpha', ago: 50 },
    ],
  },
  {
    slug: 'lost-crafters-server-switcher', name: 'Lost Crafters Server Switcher', hue: 95,
    summary: 'A server picker screen for the Lost Crafters network.',
    cf: null,
    mr: { id: 'wP7sL0eR', slug: 'lost-crafters-server-switcher', status: 'approved', raw: 'approved', total: 641, since: 0, gain: 1, thumbs: 5, pub: 47 },
    label: null, repo: null,
    releases: [
      { v: '1.1.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 24 },
      { v: '1.0.0', mc: ['1.20.1'], l: ['forge'], t: 'release', ago: 46 },
    ],
  },
  {
    slug: 'ae2-lights', name: 'AE2 Lights', hue: 55,
    summary: 'Light blocks that run on an AE2 network and dim when power drops.',
    cf: { id: 1230915, slug: 'ae2-lights', status: 'approved', raw: 'Approved', total: 412, since: 0, gain: 1, thumbs: 7, pub: 26 },
    mr: { id: 'hC3uY9tB', slug: 'processing', status: 'in_review', raw: 'processing', requested: 'approved', queuedDays: 9, msg: null, total: 0, since: 0, gain: 1, thumbs: 0, pub: 9 },
    label: 'ae2-lights', repo: 'ae2-lights',
    releases: [
      { v: '0.3.0', mc: ['26.1'], l: NEO, t: 'beta', ago: 9 },
      { v: '0.2.0', mc: ['1.21.1'], l: NEO, t: 'beta', ago: 25 },
    ],
  },
  {
    slug: 'qmk-extra-keybinds', name: 'QMK Extra Keybinds', hue: 310,
    summary: 'Binds keyboard layers and macro keys to Minecraft actions over QMK Raw HID.',
    cf: { id: 1238801, slug: 'qmk-extra-keybinds', status: 'approved', raw: 'Approved', total: 184, since: 0, gain: 1, thumbs: 4, pub: 19 },
    mr: { id: 'dE6gM2zQ', slug: 'qmk-extra-keybinds', status: 'draft', raw: 'draft', requested: 'approved', total: 0, since: 0, gain: 1, thumbs: 0, pub: 19 },
    label: 'qmk-extra-keybinds', repo: 'qmk-extra-keybinds',
    releases: [
      { v: '0.2.0', mc: ['26.1'], l: NEO, t: 'beta', ago: 12 },
      { v: '0.1.0', mc: ['1.21.1'], l: NEO, t: 'alpha', ago: 18 },
    ],
  },
  {
    slug: 'graves', name: 'Graves', hue: 240,
    summary: 'Drops a grave where you die and keeps your items safe until you come back.',
    cf: { id: 1248320, slug: 'graves-fb', status: 'approved', raw: 'Approved', total: 521, since: 0, gain: 1, thumbs: 6, pub: 12 },
    mr: { id: 'jS1nA4kW', slug: 'graves-fb', status: 'approved', raw: 'approved', total: 312, since: 0, gain: 1, thumbs: 4, pub: 12 },
    label: 'graves', repo: 'graves',
    releases: [
      { v: '1.0.1', mc: ['26.1'], l: NEO, t: 'release', ago: 5 },
      { v: '1.0.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 11 },
    ],
  },
  {
    slug: 'ae2-ee3-emc-addon', name: 'AE2 EE3 EMC Add-On', hue: 120,
    summary: 'Bridges Equivalent Exchange 3 EMC values into AE2 patterns.',
    cf: { id: 1251007, slug: 'ae2-ee3-emc-addon', status: 'changes_required', raw: 'ChangesRequired', msg: 'The description needs a licence statement and the source link must point at a public repository.', total: 0, since: 0, gain: 1, thumbs: 0, pub: 7 },
    mr: null,
    label: null, repo: 'ae2-ee3-emc-addon',
    releases: [{ v: '0.1.0', mc: ['1.7.10'], l: ['forge'], t: 'alpha', ago: 7 }],
  },
  {
    slug: 'devworld', name: 'DevWorld', hue: 160, brokenIcon: true,
    summary: 'A flat, peaceful, always-day world preset for mod development, created on first launch.',
    cf: { id: 1253344, slug: 'devworld', status: 'rejected', raw: 'Rejected', msg: 'Project description is missing a licence. Add one and resubmit.', total: 0, since: 0, gain: 1, thumbs: 0, pub: 0 },
    mr: { id: 'uZ8cH5fG', slug: 'devworld', status: 'approved', raw: 'approved', total: 85, since: 0, gain: 1, thumbs: 2, pub: 0 },
    label: 'devworld', repo: 'devworld',
    releases: [
      { v: '0.1.1', mc: ['26.1'], l: NEO, t: 'release', ago: 0 },
      { v: '0.1.0', mc: ['1.21.1'], l: NEO, t: 'release', ago: 0 },
    ],
  },
]

const MEMBER = {
  slug: 'applied-energistics-2', name: 'Applied Energistics 2', hue: 210, owned: false,
  summary: 'Store and move items digitally. The author is a member of the project.',
  cf: { id: 223794, slug: 'applied-energistics-2', status: 'approved', raw: 'Approved', total: 187400000, since: 90000, gain: 0.003, thumbs: 9000 },
  mr: null, label: null, repo: null,
  releases: [{ v: '19.2.1', mc: ['1.21.1'], l: NEO, t: 'release', ago: 20 }],
}

// ---- Issues ------------------------------------------------------------------------------------

const LABEL_TO_SLUG = {}
for (const m of MODS) if (m.label) LABEL_TO_SLUG[m.label] = m.slug
const slugName = (slug) => MODS.find((m) => m.slug === slug)?.name ?? null

const ISSUE_DEFS = [
  { n: 45, title: 'EMC values missing for modded ingots', label: 'ae2-emc', kind: 'question', ago: 8, by: 'tinkerbell', c: 2 },
  { n: 44, title: 'Benihime sheath renders at the wrong angle while sneaking', label: 'firecore', kind: 'bug', ago: 5, by: 'ironwick', c: 3 },
  { n: 43, title: 'Does a grave survive /kill?', label: 'graves', kind: 'question', ago: 2, by: 'maplesyrup', c: 1 },
  { n: 42, title: 'Config option for car speed', label: 'create-turbolifts', kind: 'enhancement', ago: 11, by: 'lowtide', c: 0 },
  { n: 41, title: 'Crash when two cars dock on the same chunk edge', label: 'create-turbolifts', kind: 'crash', ago: 3, by: 'gearhead22', c: 4 },
  { n: 40, title: 'Per-screen scale override', label: 'auto-gui-scale', kind: 'enhancement', ago: 18, by: 'pixelpusher', c: 5 },
  { n: 39, title: 'Port the Tech Add-On crystallizer recipes to datapacks', label: 'ae2-tech-addon', kind: 'enhancement', ago: 40, by: 'quartzfan', c: 2 },
  { n: 38, title: 'Traffic graph resets after a world reload', label: 'ae2-traffic-monitor', kind: 'bug', ago: 26, by: 'cablecat', c: 6 },
  { n: 37, title: 'Lights stay dark under Embeddium shader packs', label: 'ae2-lights', kind: 'compatibility', ago: 33, by: 'glowstick', c: 7 },
  { n: 36, title: 'Elevator button tooltip shows the wrong floor', label: 'create-turbolifts', kind: 'bug', ago: 14, closedAgo: 12, by: 'lowtide', c: 3 },
  { n: 35, title: 'Scale resets when the window is maximised', label: 'auto-gui-scale', kind: 'bug', ago: 60, closedAgo: 52, by: 'pixelpusher', c: 4 },
  { n: 34, title: 'Expose tassle physics strength in the config', label: 'firecore', kind: 'enhancement', ago: 29, closedAgo: 21, by: 'ironwick', c: 2 },
  { n: 33, title: 'Seed field ignores negative numbers', label: 'default-world-generator', kind: 'bug', ago: 120, closedAgo: 97, by: 'seedlord', c: 5 },
  { n: 32, title: 'Notification stays on screen after the stream ends', label: 'twitch-notifier', kind: 'bug', ago: 300, closedAgo: 280, by: 'streamsnipe', c: 3 },
  { n: 31, title: 'Support 26.1', label: 'ae2-traffic-monitor', kind: 'enhancement', ago: 45, closedAgo: 30, by: 'cablecat', c: 8 },
]

const issueItems = ISSUE_DEFS.map((d) => {
  const slug = LABEL_TO_SLUG[d.label] ?? null
  const closed = d.closedAgo !== undefined
  const labels = [`mod: ${d.label}`, d.kind]
  return {
    number: d.n, title: d.title, state: closed ? 'closed' : 'open',
    url: `${REPO}/mod-issues/issues/${d.n}`,
    modSlug: slug, modName: slug ? slugName(slug) : null, modLabel: d.label,
    kind: d.kind, labels, author: d.by, comments: d.c,
    createdAt: daysAgo(d.ago, 16, 40), updatedAt: daysAgo(closed ? d.closedAgo : Math.max(0, d.ago - 1), 11, 5),
    closedAt: closed ? daysAgo(d.closedAgo, 11, 5) : null,
  }
})
const openIssues = issueItems.filter((i) => i.state === 'open')

function githubFor(m) {
  if (!m.label) return null
  const mine = openIssues.filter((i) => i.modLabel === m.label)
  const bugs = mine.filter((i) => i.kind === 'bug' || i.kind === 'crash')
  return {
    label: m.label, open: mine.length,
    openBugs: mine.filter((i) => i.kind === 'bug').length,
    openCrashes: mine.filter((i) => i.kind === 'crash').length,
    oldestOpenBugAt: bugs.length ? bugs.map((b) => b.createdAt).sort()[0] : null,
  }
}

// ---- Downloads history -------------------------------------------------------------------------

/** Cumulative series over the last DAYS days (index 0 oldest). Days before the first snapshot are null. */
function series(total, p) {
  const age = p.pub ?? 9999
  const n = Math.min(DAYS, age + 1)
  const out = new Array(DAYS).fill(null)
  if (total === 0) {
    for (let i = DAYS - n; i < DAYS; i++) out[i] = 0
    return out
  }
  const gained = Math.round(total * (p.gain ?? 1))
  const w = []
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const launch = p.gain === 1 ? 1 + 2.2 * Math.exp(-t * 7) : 1
    const weekly = 1 + 0.18 * Math.sin((i / 7) * Math.PI * 2)
    w.push(launch * weekly * (0.75 + rnd() * 0.5))
  }
  const sum = w.reduce((a, b) => a + b, 0)
  let cum = total - gained
  let carry = 0
  for (let i = 0; i < n; i++) {
    const exact = (gained * w[i]) / sum + carry
    const inc = i === n - 1 ? total - cum : Math.round(exact)
    carry = exact - inc
    cum += inc
    out[DAYS - n + i] = cum
  }
  return out
}

function deltas(s) {
  const last = s[DAYS - 1]
  const d1 = s[DAYS - 2]
  const d7 = s[DAYS - 8]
  return {
    delta24h: d1 === null ? null : last - d1,
    delta7d: d7 === null ? null : last - d7,
  }
}

const points = (cf, mr) => {
  const out = []
  for (let i = 0; i < DAYS; i++) {
    if (cf[i] === null && mr[i] === null) continue
    out.push({ at: dayEnd(DAYS - 1 - i), curseforge: cf[i] ?? 0, modrinth: mr[i] ?? 0 })
  }
  return out
}

// ---- Build mods --------------------------------------------------------------------------------

const platUrl = (plat, slug) =>
  plat === 'curseforge' ? `https://www.curseforge.com/minecraft/mc-mods/${slug}` : `https://modrinth.com/mod/${slug}`

function build(m) {
  const owned = m.owned !== false
  const sCF = m.cf ? series(m.cf.total, m.cf) : new Array(DAYS).fill(null)
  const sMR = m.mr ? series(m.mr.total, m.mr) : new Array(DAYS).fill(null)
  const dCF = m.cf ? deltas(sCF) : null
  const dMR = m.mr ? deltas(sMR) : null

  // A mod with no files older than a day has no 24h or 7d to show; its platform deltas are null.
  const info = (plat, c, d) => {
    if (!c) return null
    return {
      platform: plat, id: String(c.id), slug: c.slug, url: platUrl(plat, c.slug),
      status: c.status, rawStatus: c.raw, statusMessage: c.msg ?? null,
      requestedStatus: c.requested ?? null,
      queuedAt: c.queuedDays ? daysAgo(c.queuedDays, 10, 2) : null,
      downloads: c.total, delta24h: d.delta24h, delta7d: d.delta7d,
      followers: c.thumbs ?? null,
      publishedAt: c.pub !== undefined ? daysAgo(c.pub, 9, 30) : daysAgo((m.releases.at(-1)?.ago ?? 800) + 20, 9, 30),
      updatedAt: daysAgo(Math.min(...m.releases.map((r) => r.ago)), 9, 12),
      files: 0,
    }
  }
  const cf = info('curseforge', m.cf, dCF)
  const mr = info('modrinth', m.mr, dMR)

  // Files: one per release per platform. Downloads follow age (new files get the most recent traffic).
  const files = []
  for (const [plat, c, pinfo] of [['curseforge', m.cf, cf], ['modrinth', m.mr, mr]]) {
    if (!c) continue
    const ws = m.releases.map((r) => 1 / (1 + r.ago / 150))
    const wsum = ws.reduce((a, b) => a + b, 0)
    let left = c.total
    m.releases.forEach((r, i) => {
      const share = ws[i] / wsum
      const dl = i === m.releases.length - 1 ? left : Math.round(c.total * share)
      left -= dl
      const published = plat === 'modrinth' ? iso(Date.parse(daysAgo(r.ago, 9, 12)) + 2 * 3600_000) : daysAgo(r.ago, 9, 12)
      files.push({
        platform: plat, id: `${plat === 'curseforge' ? 'cf' : 'mr'}-${m.slug}-${r.v}-${r.mc[0]}`,
        modSlug: m.slug, modName: m.name,
        name: plat === 'curseforge' ? `${c.slug}-${r.v}+${r.mc[0]}.jar` : `${m.name} ${r.v} for ${r.mc[0]}`,
        version: r.v, releaseType: r.t, minecraftVersions: sortMcDesc(r.mc), loaders: r.l,
        publishedAt: published, downloads: Math.max(0, dl),
        delta24h: pinfo.delta24h === null ? null : Math.round(pinfo.delta24h * share),
        delta7d: pinfo.delta7d === null ? null : Math.round(pinfo.delta7d * share),
        url: plat === 'curseforge' ? `${platUrl(plat, c.slug)}/files/${900000 + files.length}` : `${platUrl(plat, c.slug)}/version/${r.v}-${r.mc[0]}`,
        _ago: r.ago, _share: share,
      })
    })
    pinfo.files = m.releases.length
  }
  files.sort((a, b) => b.downloads - a.downloads)

  const total = (m.cf?.total ?? 0) + (m.mr?.total ?? 0)
  const nullDeltas = (dCF === null || dCF.delta24h === null) && (dMR === null || dMR.delta24h === null)
  const down24 = (dCF?.delta24h ?? 0) + (dMR?.delta24h ?? 0)
  const down7 = (dCF?.delta7d ?? 0) + (dMR?.delta7d ?? 0)
  const downloads = {
    total, curseforge: m.cf?.total ?? 0, modrinth: m.mr?.total ?? 0,
    delta24h: nullDeltas ? null : down24,
    delta7d: (dCF && dCF.delta7d !== null) || (dMR && dMR.delta7d !== null) ? down7 : null,
  }
  const latest = [...m.releases].sort((a, b) => a.ago - b.ago)[0]
  const latestPlat = m.mr && m.cf ? 'modrinth' : m.mr ? 'modrinth' : 'curseforge'
  const mcAll = sortMcDesc(m.releases.flatMap((r) => r.mc))
  const loaders = [...new Set(m.releases.flatMap((r) => r.l))].sort()

  return {
    m, owned, cf, mr, files, sCF, sMR, downloads, mcAll, loaders,
    latestRelease: {
      platform: latestPlat, version: latest.v, releaseType: latest.t,
      publishedAt: daysAgo(latest.ago, 9, 12), minecraftVersions: sortMcDesc(latest.mc),
    },
  }
}

const built = [...MODS.map(build), build(MEMBER)]

const NEWEST_MC = sortMcDesc(built.filter((b) => b.owned).flatMap((b) => b.mcAll))[0]

// ---- Attention ---------------------------------------------------------------------------------

function attentionFor(b) {
  const { m } = b
  const items = []
  const add = (severity, kind, title, detail, url = null) =>
    items.push({ severity, kind, modSlug: m.slug, title, detail, url })
  for (const i of openIssues.filter((x) => x.modLabel === m.label && x.kind === 'crash'))
    add('problem', 'crash_open', `Open crash in ${m.name}`, `#${i.number}: ${i.title}`, i.url)
  for (const [c, name] of [[b.cf, 'CurseForge'], [b.mr, 'Modrinth']]) {
    if (!c) continue
    if (c.status === 'changes_required')
      add('problem', 'not_approved', `${m.name} needs changes on ${name}`, c.statusMessage ?? 'The moderators asked for changes.', c.url)
    else if (c.status === 'rejected')
      add('problem', 'not_approved', `${m.name} was rejected on ${name}`, c.statusMessage ?? 'The moderators rejected the project.', c.url)
    else if (c.status === 'draft')
      add('warning', 'not_approved', `${m.name} is still a draft on ${name}`, 'Submit it for review to publish it.', c.url)
    else if (c.status === 'in_review' && c.queuedAt) {
      const days = Math.floor((NOW - Date.parse(c.queuedAt)) / DAY)
      if (days >= 7) add('warning', 'review_stuck', `${m.name} has waited ${days} days for review on ${name}`, `Requested: ${c.requestedStatus ?? 'approved'}.`, c.url)
      else add('info', 'review_pending', `${m.name} is in review on ${name}`, `Queued ${days} days ago.`, c.url)
    }
  }
  for (const i of openIssues.filter((x) => x.modLabel === m.label && x.kind === 'bug'))
    add('warning', 'bug_open', `Open bug in ${m.name}`, `#${i.number}: ${i.title}`, i.url)
  if (b.owned && !b.mcAll.includes(NEWEST_MC) && b.mcAll.some((v) => cmpMc(v, '26') >= 0))
    add(b.mcAll.includes('26.2') ? 'warning' : 'info', 'no_latest_minecraft', `${m.name} has no file for ${NEWEST_MC}`, `Newest target is ${b.mcAll[0]}.`)
  if (b.owned && (!b.cf || !b.mr) && m.slug !== 'twitch-notifier' && m.slug !== 'ae2-ee3-emc-addon' && m.slug !== 'lost-crafters-server-switcher')
    add('info', 'missing_platform', `${m.name} is only on ${b.cf ? 'CurseForge' : 'Modrinth'}`, 'No project on the other platform is linked.')
  if (b.owned && Math.min(...m.releases.map((r) => r.ago)) > 365)
    add('info', 'stale_release', `${m.name} has had no release in ${Math.round(Math.min(...m.releases.map((r) => r.ago)) / 365 * 10) / 10} years`, 'Last release is over a year old.')
  return items
}
const sevRank = { problem: 0, warning: 1, info: 2 }
const healthOf = (items) => (items.some((i) => i.severity === 'problem') ? 'problem' : items.some((i) => i.severity === 'warning') ? 'attention' : 'ok')

const summaries = built.map((b) => {
  const attention = attentionFor(b).sort((x, y) => sevRank[x.severity] - sevRank[y.severity])
  b.attention = attention
  return {
    slug: b.m.slug, name: b.m.name, iconUrl: iconFor(b.m), summary: b.m.summary, owned: b.owned,
    curseforge: b.cf, modrinth: b.mr, github: githubFor(b.m),
    downloads: b.downloads, latestRelease: b.latestRelease,
    minecraftVersions: b.mcAll, loaders: b.loaders,
    health: healthOf(attention), attention,
  }
})
built.forEach((b, i) => (b.summary = summaries[i]))

function iconFor(m) {
  if (m.icon === false) return ''
  if (m.brokenIcon) return 'https://cdn.modrinth.com/data/uZ8cH5fG/icon-missing.png'
  const h = m.hue
  const g = m.name.split(/[\s:]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h} 70% 55%)'/><stop offset='1' stop-color='hsl(${(h + 40) % 360} 65% 28%)'/></linearGradient></defs><rect width='64' height='64' rx='10' fill='url(#g)'/><path d='M0 46h64v18H0z' fill='rgba(0,0,0,.18)'/><text x='32' y='41' text-anchor='middle' font-family='monospace' font-weight='700' font-size='26' fill='white'>${g}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// ---- Overview ----------------------------------------------------------------------------------

const ownedSums = summaries.filter((s) => s.owned)
const ownedBuilt = built.filter((b) => b.owned)
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0)
const allFiles = built.flatMap((b) => b.files)
const releaseItems = (limit) =>
  allFiles
    .filter((f) => f.modSlug !== MEMBER.slug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
    .map((f) => ({
      platform: f.platform, modSlug: f.modSlug, modName: f.modName, version: f.version, name: f.name,
      releaseType: f.releaseType, minecraftVersions: f.minecraftVersions, loaders: f.loaders,
      publishedAt: f.publishedAt, downloads: f.downloads, url: f.url,
    }))

const sources = [
  { source: 'curseforge', ok: true, checkedAt: LAST_POLL, lastOkAt: LAST_POLL },
  { source: 'modrinth', ok: true, detail: 'Token set. Drafts and projects in review are included.', checkedAt: LAST_POLL, lastOkAt: LAST_POLL },
  { source: 'github', ok: false, error: 'GitHub returned 403: API rate limit exceeded. Resets at 14:42.', detail: 'No token set, so requests share the anonymous limit of 60 an hour.', checkedAt: LAST_POLL, lastOkAt: daysAgo(0, 11, 30) },
]

const globalAttention = [
  ...ownedSums.flatMap((s) => s.attention),
  { severity: 'warning', kind: 'source_down', modSlug: null, title: 'GitHub could not be read', detail: sources[2].error, url: null },
  { severity: 'info', kind: 'unlinked', modSlug: 'ae2-tech-addon', title: 'AE2 Tech Addon on Modrinth is not linked to a mod', detail: 'A project with a similar name exists. Link it in Settings.', url: null },
].sort((a, b) => sevRank[a.severity] - sevRank[b.severity])

const totals = {
  mods: ownedSums.length,
  downloads: {
    total: sum(ownedSums, (s) => s.downloads.total),
    curseforge: sum(ownedSums, (s) => s.downloads.curseforge),
    modrinth: sum(ownedSums, (s) => s.downloads.modrinth),
    delta24h: sum(ownedSums, (s) => s.downloads.delta24h ?? 0),
    delta7d: sum(ownedSums, (s) => s.downloads.delta7d ?? 0),
  },
  openIssues: openIssues.length,
  openBugs: openIssues.filter((i) => i.kind === 'bug').length,
  openCrashes: openIssues.filter((i) => i.kind === 'crash').length,
  needAttention: ownedSums.filter((s) => s.health !== 'ok').length,
  inReview: sum(ownedSums, (s) => [s.curseforge, s.modrinth].filter((p) => p && ['in_review', 'draft', 'changes_required', 'rejected'].includes(p.status)).length),
  legacyMods: ownedSums.filter((s) => s.legacy).length,
}

const polls = {
  lastPoll: { id: 412, startedAt: iso(Date.parse(LAST_POLL) - 6200), finishedAt: LAST_POLL, state: 'ok', mods: 15 },
}
const overview = {
  version: '26.11.1',
  schedule: '*/30 * * * *',
  polling: false,
  totals,
  attention: globalAttention,
  mods: ownedSums.sort((a, b) => b.downloads.total - a.downloads.total),
  recentReleases: releaseItems(8),
  sources,
  lastPoll: polls.lastPoll,
  lastOkPoll: polls.lastPoll,
  problems: [],
}

// ---- Versions ----------------------------------------------------------------------------------

const ownedFiles = ownedBuilt.flatMap((b) => b.files)
function tally(keyOf) {
  const map = new Map()
  for (const f of ownedFiles)
    for (const k of keyOf(f)) {
      const t = map.get(k) ?? { name: k, downloads: 0, curseforge: 0, modrinth: 0, files: 0 }
      t.downloads += f.downloads
      t[f.platform] += f.downloads
      t.files += 1
      map.set(k, t)
    }
  return [...map.values()]
}
const gameVersions = tally((f) => f.minecraftVersions).sort((a, b) => cmpMc(b.name, a.name))
const loaderTotals = tally((f) => f.loaders).sort((a, b) => b.downloads - a.downloads)
const allVersions = gameVersions.map((g) => g.name)

const matrixRows = ownedBuilt
  .map((b) => {
    const cells = {}
    for (const f of b.files)
      for (const v of f.minecraftVersions) {
        const c = (cells[v] ??= { downloads: 0, platforms: [] })
        c.downloads += f.downloads
        if (!c.platforms.includes(f.platform)) c.platforms.push(f.platform)
      }
    return { slug: b.m.slug, name: b.m.name, iconUrl: b.summary.iconUrl, cells, total: b.downloads.total }
  })
  .sort((a, b) => b.total - a.total)
  .map(({ total, ...r }) => (void total, r))

const vHistory = {}
for (const g of gameVersions) {
  if (g.downloads === 0) continue
  const arr = new Array(DAYS).fill(0)
  for (const b of ownedBuilt)
    for (const f of b.files) {
      if (!f.minecraftVersions.includes(g.name)) continue
      const s = f.platform === 'curseforge' ? b.sCF : b.sMR
      const tot = f.platform === 'curseforge' ? b.m.cf.total : b.m.mr.total
      for (let i = 0; i < DAYS; i++) {
        const age = DAYS - 1 - i
        if (age > f._ago || s[i] === null || tot === 0) continue
        arr[i] += Math.round(f.downloads * (s[i] / tot))
      }
    }
  vHistory[g.name] = arr.map((d, i) => ({ at: dayEnd(DAYS - 1 - i), downloads: d }))
}
const versions = {
  latestMinecraft: NEWEST_MC,
  gameVersions, loaders: loaderTotals,
  matrix: { versions: allVersions, rows: matrixRows },
  history: vHistory,
}

// ---- History -----------------------------------------------------------------------------------

const perMod = {}
for (const b of ownedBuilt) perMod[b.m.slug] = points(b.sCF, b.sMR)
const totalPoints = []
for (let i = 0; i < DAYS; i++) {
  totalPoints.push({
    at: dayEnd(DAYS - 1 - i),
    curseforge: sum(ownedBuilt, (b) => b.sCF[i] ?? 0),
    modrinth: sum(ownedBuilt, (b) => b.sMR[i] ?? 0),
  })
}
const history = { days: DAYS, total: totalPoints, perMod }

// ---- Detail ------------------------------------------------------------------------------------

const modDetail = {}
for (const b of built) {
  const s = b.summary
  const mine = issueItems.filter((i) => i.modLabel === b.m.label && b.m.label)
  const mv = new Map()
  for (const f of b.files)
    for (const v of f.minecraftVersions) {
      const t = mv.get(v) ?? { name: v, downloads: 0, curseforge: 0, modrinth: 0, files: 0 }
      t.downloads += f.downloads
      t[f.platform] += f.downloads
      t.files += 1
      mv.set(v, t)
    }
  modDetail[b.m.slug] = {
    ...s,
    files: b.files.map(({ _ago, _share, ...f }) => (void _ago, void _share, f)),
    history: b.owned ? perMod[b.m.slug] : points(b.sCF, b.sMR).filter(() => false),
    gameVersions: [...mv.values()].sort((a, c) => cmpMc(c.name, a.name)),
    issues: mine,
    links: {
      curseforge: b.cf?.url ?? null, modrinth: b.mr?.url ?? null,
      github: b.m.repo ? `${REPO}/${b.m.repo}` : null,
      source: b.m.repo ? `${REPO}/${b.m.repo}` : null,
      issues: b.m.label ? `${REPO}/mod-issues/issues?q=label%3A%22mod%3A+${b.m.label}%22` : null,
      wiki: ['firecore', 'auto-gui-scale', 'create-turbolifts'].includes(b.m.slug) ? `${REPO}/${b.m.repo}/wiki` : null,
      discord: b.m.slug === 'firecore' ? 'https://discord.gg/modwatch-mock' : null,
    },
  }
}
// ---- Issues ------------------------------------------------------------------------------------

const byModMap = new Map()
for (const i of openIssues.filter((x) => x.modSlug)) {
  const e = byModMap.get(i.modSlug) ?? { slug: i.modSlug, name: i.modName, open: 0, bugs: 0, crashes: 0, oldestOpenAt: null }
  e.open += 1
  if (i.kind === 'bug') e.bugs += 1
  if (i.kind === 'crash') e.crashes += 1
  if (!e.oldestOpenAt || i.createdAt < e.oldestOpenAt) e.oldestOpenAt = i.createdAt
  byModMap.set(i.modSlug, e)
}
const kinds = ['crash', 'bug', 'compatibility', 'enhancement', 'question', 'other']
const issuesFx = {
  repo: 'FireBall1725/mod-issues',
  summary: {
    open: openIssues.length, closed: issueItems.length - openIssues.length,
    openBugs: totals.openBugs, openCrashes: totals.openCrashes,
    oldestOpenAt: openIssues.map((i) => i.createdAt).sort()[0] ?? null,
    byMod: [...byModMap.values()].sort((a, b) => b.crashes - a.crashes || b.bugs - a.bugs || b.open - a.open),
    byKind: kinds.map((k) => ({ kind: k, open: openIssues.filter((i) => i.kind === k).length })).filter((k) => k.open > 0),
  },
  issues: [...issueItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
}

// ---- Catalog -----------------------------------------------------------------------------------

const entries = built.map((b) => ({
  slug: b.m.slug, name: b.m.name,
  curseforgeId: b.m.cf ? b.m.cf.id : null, modrinthId: b.m.mr ? b.m.mr.id : null,
  githubLabel: b.m.manualLabel || b.m.manual ? b.m.label : null,
  hidden: false, auto: !(b.m.manual || b.m.manualLabel),
}))
entries.push({ slug: 'devworld-sandbox', name: 'DevWorld Sandbox', curseforgeId: 1240021, modrinthId: null, githubLabel: null, hidden: true, auto: true })
const catalog = {
  entries,
  unlinked: {
    projects: [
      { platform: 'modrinth', id: 'eR5tB2vN', slug: 'ae2-tech-addon', name: 'AE2 Tech Addon', iconUrl: iconFor({ hue: 190, name: 'AE2 Tech Addon' }), url: platUrl('modrinth', 'ae2-tech-addon'), owned: true },
      { platform: 'curseforge', id: '1190008', slug: 'applied-energistics-2-wireless-terminals', name: 'Applied Energistics 2 Wireless Terminals', iconUrl: iconFor({ hue: 250, name: 'AE2 Wireless' }), url: platUrl('curseforge', 'applied-energistics-2-wireless-terminals'), owned: false },
    ],
    githubLabels: [{ label: 'ae2-emc', issues: 1 }],
  },
}

// ---- Legacy summary ----------------------------------------------------------------------------

const allDown = sum(summaries, (s) => s.downloads.total)
const summaryFx = {
  version: overview.version, schedule: overview.schedule, polling: false, problems: [],
  owned: { mods: ownedSums.length, downloads: totals.downloads.total, delta24h: totals.downloads.delta24h, delta7d: totals.downloads.delta7d },
  all: { mods: summaries.length, downloads: allDown, delta24h: totals.downloads.delta24h, delta7d: totals.downloads.delta7d },
  lastPoll: polls.lastPoll, lastOkPoll: polls.lastPoll, sources,
}

const write = (name, data) => writeFileSync(OUT + name, JSON.stringify(data, null, 1) + '\n')
write('overview.json', overview)
write('mods.json', summaries.sort((a, b) => b.downloads.total - a.downloads.total))
write('mod-detail.json', modDetail)
write('downloads-history.json', history)
write('versions.json', versions)
write('releases.json', releaseItems(50))
write('issues.json', issuesFx)
write('catalog.json', catalog)
write('summary.json', summaryFx)
console.log('fixtures written; mods:', summaries.length, 'newest mc:', NEWEST_MC)
