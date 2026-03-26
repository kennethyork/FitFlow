import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0f1117)', padding: 20 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
            <h2 style={{ color: 'var(--text-primary, #f3f4f6)', fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 14, marginBottom: 20 }}>
              The app ran into an unexpected error. Your data is safe.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              style={{ background: '#00a86b', color: 'white', border: 'none', padding: '12px 32px', borderRadius: 9999, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
