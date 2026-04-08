import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  componentName?: string
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.componentName ? `: ${this.props.componentName}` : ''}]`, error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      // Local (inline) boundary for sub-components
      if (this.props.componentName) {
        return (
          <div className="p-4 border border-red-500/30 rounded bg-red-500/5 text-center">
            <p className="text-sm text-red-400 mb-1">
              {this.props.componentName} crashed
            </p>
            {this.state.error && (
              <pre className="text-xs text-red-400/70 mb-2 overflow-auto max-h-20 text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleRecover}
              className="px-3 py-1 rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-xs mr-2"
            >
              Retry
            </button>
            <button
              onClick={this.handleReload}
              className="px-3 py-1 rounded bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer text-xs"
            >
              Reload
            </button>
          </div>
        )
      }

      // Full-page boundary (root)
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
