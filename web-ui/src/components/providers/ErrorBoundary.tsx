/* 16.14: Global error boundary component.
 *
 * Catches React render errors and displays actionable fallback UI.
 * Never shows raw error details to users in production.
 */
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorCode: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCode: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorCode: error.name || 'RENDER_ERROR',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to observability — never surface raw errors to user
    console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-surface-200 backdrop-blur"
        >
          <svg
            className="h-12 w-12 text-surface-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">
            Something went wrong
          </h3>
          <p className="max-w-md text-surface-300">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorCode: '' });
              window.location.reload();
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
