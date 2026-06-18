'use client';

import { Component, type ReactNode } from 'react';

/**
 * Catches render/lifecycle errors so an unexpected exception shows a recoverable
 * screen instead of leaving a half-torn DOM (e.g. a stuck modal backdrop that
 * swallows clicks) that forces the user to restart the whole app. "Riprova"
 * clears the error and re-renders; the data layer (React Query) is untouched.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-bold">Si è verificato un errore</h2>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Riprova
            </button>
            <button
              onClick={() => location.reload()}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Ricarica
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
