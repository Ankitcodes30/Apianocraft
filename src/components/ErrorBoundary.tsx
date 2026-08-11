import { Component, type ReactNode } from 'react'
import { pushError } from '../utils/ErrorBus'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    pushError('error', error instanceof Error ? error.message : String(error))
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fatal">
          <h1>Apianocraft hit an unexpected error.</h1>
          <button
            type="button"
            className="btn"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
