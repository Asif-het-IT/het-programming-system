import React from 'react';
import { Logger } from '@/lib/logger';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    Logger.error('React Component Error', error, {
      component: this.props.fallback ? 'WithFallback' : 'Unknown',
      stack: errorInfo.componentStack,
      errorId
    });

    this.setState({ 
      error, 
      errorId,
      componentStack: errorInfo.componentStack 
    });
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorId: null,
      retryCount: this.state.retryCount + 1
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
              <div>
                <h1 className="font-bold text-foreground">Something went wrong</h1>
                <p className="text-xs text-muted-foreground mt-1">Error ID: {this.state.errorId}</p>
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-3 mb-4 max-h-32 overflow-auto">
              <p className="text-xs font-mono text-destructive/80 whitespace-pre-wrap break-words">
                {this.state.error?.message}
              </p>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={this.handleReset}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = '/'}
              >
                Go to Dashboard
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4 text-center">
              Error has been logged. Please contact support with Error ID if issue persists.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
