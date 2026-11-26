'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  details?: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected error occurred.';
    let details = '';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        message = parsed.error;
        details = `Operation: ${parsed.operationType || 'unknown'} · Path: ${parsed.path || 'n/a'}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error) {
    console.error('Pravaclin ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold">Application Error</h1>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
              {this.state.message}
            </p>
            {this.state.details && (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-5 break-all">
                {this.state.details}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '', details: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
