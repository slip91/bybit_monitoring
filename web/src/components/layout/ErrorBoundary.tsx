import { Component, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-surface)] p-6 text-[var(--color-error-text)]">
          <p className="font-medium">Ошибка секции</p>
          <p className="text-sm opacity-80">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-1 rounded-lg border border-[var(--color-error-border)] px-4 py-1.5 text-sm hover:opacity-80"
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
