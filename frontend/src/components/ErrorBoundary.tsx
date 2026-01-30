import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  handleReset = () => {
    // Clear localStorage
    localStorage.removeItem('image-sorter-storage');
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-macos-dark-bg-1">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-xl font-semibold text-white mb-4">
              Something went wrong
            </h1>
            <p className="text-macos-dark-text-secondary mb-2">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <p className="text-macos-dark-text-tertiary text-sm mb-6">
              This might be due to corrupted app data. Click below to reset and try again.
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
            >
              Reset App & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
