import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UP Heritage Companion UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-shell">
          <div className="tricolour-bar" />
          <div className="error-boundary-shell__inner">
            <div className="api-state-card is-error" role="alert">
              <div className="api-state-card__halo is-error" aria-hidden="true">
                <AlertTriangle size={28} />
              </div>
              <div className="api-state-card__body">
                <h1 className="api-state-card__title" style={{ fontSize: '1.35rem' }}>
                  Something went wrong
                </h1>
                <p className="api-state-card__sub">
                  UP AI Heritage Companion encountered an unexpected issue. Reloading restores your session safely.
                </p>
                {this.state.errorMessage && (
                  <div className="api-state-card__detail">{this.state.errorMessage}</div>
                )}
                <div className="api-state-card__actions">
                  <button type="button" className="pill-btn is-saffron" onClick={this.handleReload}>
                    <RefreshCw size={16} />
                    <span>Reload App</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

