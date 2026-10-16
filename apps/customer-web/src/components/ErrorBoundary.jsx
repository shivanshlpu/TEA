import React from 'react';
import { Coffee } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Customer Web Uncaught UI Error:', error, errorInfo);
  }

  handleReload = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-2xl shadow-lg border border-amber-200">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
              <Coffee className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              We encountered a glitch while rendering the page. Click below to refresh your session.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition"
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
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
