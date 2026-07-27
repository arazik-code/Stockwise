import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 mb-4 max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <details className="text-sm text-slate-500 mb-4 max-w-lg">
            <summary className="cursor-pointer hover:text-slate-700">Error details</summary>
            <pre className="mt-2 text-left bg-slate-100 p-3 rounded overflow-auto text-xs">
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
