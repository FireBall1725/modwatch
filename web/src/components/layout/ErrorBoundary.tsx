// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { withTranslation, type WithTranslation } from 'react-i18next'
import Button from '../ui/Button'
import ErrorState from '../ui/ErrorState'

interface Props extends WithTranslation {
  children: ReactNode
  /** Changing this clears the error, so navigating away from a broken page recovers. */
  resetKey?: string
}

class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('page crashed', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    const { t } = this.props
    if (!error) return this.props.children
    return (
      <div className="mx-auto max-w-xl py-16">
        <ErrorState title={t('error.boundaryTitle')} error={error} />
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" icon="refresh" onClick={() => window.location.reload()}>
            {t('error.reload')}
          </Button>
        </div>
      </div>
    )
  }
}

/** Catches a render error in a page and shows an error state instead of a blank screen. Props: children, resetKey (usually the pathname). */
export default withTranslation('common')(Boundary)
