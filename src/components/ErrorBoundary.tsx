import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface Props {
  children: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Production React Error Boundary.
 * Catches rendering errors in individual UI panels without crashing the audio engine
 * or unmounting the virtual piano keyboard.
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary] Render crash in panel "${this.props.name ?? 'UI'}":`, error, errorInfo)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="ap-error-boundary" data-error-boundary={this.props.name ?? 'panel'}>
          <div className="ap-error-boundary__title">
            ⚠️ {this.props.name ? `${this.props.name} UI Error` : 'Panel UI Error'}
          </div>
          <div className="ap-error-boundary__msg">
            {this.state.error?.message ?? 'An unexpected rendering error occurred.'}
          </div>
          <div className="ap-error-boundary__sub">Audio engine remains fully operational.</div>
          <button
            type="button"
            className="ap-btn ap-btn--small ap-btn--accent"
            onClick={this.handleReset}
            data-btn-retry
          >
            Retry Panel
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
