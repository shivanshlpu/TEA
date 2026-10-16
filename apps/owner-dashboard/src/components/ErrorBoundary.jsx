import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Owner Dashboard Uncaught UI Error:', error, errorInfo);
  }

  handleReload = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-neutral-800 p-8 rounded-2xl shadow-xl border border-neutral-700">
            <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Dashboard Error</h1>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              An unexpected error occurred. Click below to refresh your session.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition"
              >
                Reload Dashboard
              </button>
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 font-semibold rounded-xl text-xs transition"
              >
                Clear Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
