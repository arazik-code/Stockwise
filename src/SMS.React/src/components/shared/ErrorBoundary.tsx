import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

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
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center bg-canvas text-fg">
          <span
            data-tone="negative"
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-chip bg-[var(--tone-soft)] text-[var(--tone)]"
          >
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mb-2 text-lg font-semibold text-fg">Une erreur est survenue</h2>
          <p className="mb-4 max-w-md text-sm text-fg-subtle">
            Une erreur inattendue s'est produite. Essayez de recharger la page.
          </p>
          <details className="mb-4 max-w-lg text-sm text-fg-subtle">
            <summary className="cursor-pointer transition-colors hover:text-fg">
              Détails de l'erreur
            </summary>
            <pre className="mt-2 overflow-auto rounded-inset bg-sunken p-3 text-left text-xs text-fg-muted">
              {this.state.error?.message}
            </pre>
          </details>
          {/* No section context is guaranteed here - the boundary wraps the
              whole app outside any <Page>, so --accent is undefined. Use the
              neutral ink scale instead of an accent token. */}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-field bg-[var(--ink-900)] px-4 py-2 text-sm font-medium text-white shadow-e1 transition-colors hover:bg-[var(--ink-800)]"
          >
            <RotateCw className="h-4 w-4" />
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
