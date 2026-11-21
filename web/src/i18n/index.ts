// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// One namespace per file in locales/, named after the file: common.json is "common", modDetail.json is "modDetail".
// Pages call useTranslation('<namespace>'); shared words live in common.
const modules = import.meta.glob<Record<string, unknown>>('./locales/*.json', { eager: true, import: 'default' })

const en: Record<string, Record<string, unknown>> = {}
for (const [path, content] of Object.entries(modules)) {
  const ns = path.replace('./locales/', '').replace(/\.json$/, '')
  en[ns] = content
}

void i18n.use(initReactI18next).init({
  resources: { en },
  lng: 'en',
  fallbackLng: 'en',
  ns: Object.keys(en),
  defaultNS: 'common',
  // React already escapes, so i18next must not double-escape interpolations.
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export default i18n
