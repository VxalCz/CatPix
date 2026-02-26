import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-bg-primary">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-8 max-w-md text-center">
            <h1 className="text-lg font-semibold text-text-primary mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-text-secondary mb-4">
              CatPix encountered an unexpected error. Your sprites may have been auto-saved.
            </p>
            {this.state.error && (
              <pre className="text-xs text-red-400 bg-bg-primary rounded p-3 mb-4 overflow-auto max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer text-sm"
            >
              Reload CatPix
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
