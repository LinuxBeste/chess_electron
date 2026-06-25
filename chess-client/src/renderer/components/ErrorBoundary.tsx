/**
 * ErrorBoundary — React class component that catches render-phase errors
 * in its subtree and displays a fallback UI instead of a white screen.
 *
 * Class component is required (React error boundaries can't be function
 * components).  getDerivedStateFromError is the standard React pattern.
 */

import { Component, type ReactNode } from 'react';
import { t } from '../translate';
import logger from '../logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    logger.error('ErrorBoundary caught: ' + error.message);
    return { hasError: true, error };
  }

  // Resets error state so children re-render (does not reload the page)
  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 16,
            padding: 24,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0' }}>{t('errorBoundary.title')}</h1>
          <p style={{ fontSize: 14, color: '#888', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || t('errorBoundary.message')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={this.handleReload}>
              {t('errorBoundary.tryAgain')}
            </button>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              {' '}
              {/* full page reload as last resort */}
              {t('errorBoundary.reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
