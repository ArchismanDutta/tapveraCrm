import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent)
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });

    // Log to console for debugging
    console.error('Error Boundary caught:', error, errorInfo);

    // Store error for debugging
    try {
      sessionStorage.setItem('lastError', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      // Ignore if sessionStorage fails
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          maxWidth: '600px',
          margin: '50px auto'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            We're sorry, the application encountered an error.
          </p>
          {this.state.isIOS && (
            <p style={{
              color: '#ff6b6b',
              fontSize: '14px',
              marginBottom: '20px',
              padding: '10px',
              background: '#fff3f3',
              borderRadius: '8px'
            }}>
              ⚠️ iOS Compatibility Issue Detected
            </p>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            Reload App
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '30px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                background: '#f5f5f5',
                padding: '15px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '10px',
                borderRadius: '4px',
                maxHeight: '300px'
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
