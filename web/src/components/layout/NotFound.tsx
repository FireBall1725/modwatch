// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import PageHeader from '../ui/PageHeader'

/** Shown for any path no route claims. */
export default function NotFound() {
  const { t } = useTranslation('common')
  return (
    <>
      <PageHeader title={t('notFound.title')} />
      <EmptyState icon="search" title={t('notFound.heading')} description={t('notFound.body')} action={<Button href="/" variant="primary">{t('nav.overview')}</Button>} />
    </>
  )
}
