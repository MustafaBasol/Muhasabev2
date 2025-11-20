import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    try {
      console.error(`[ErrorBoundary:${this.props.name || 'root'}]`, error, info);
      // Basit global event: UI başka yerde toast gösterebilir
      const evt = new CustomEvent('showToast', { detail: { message: 'Bir hata oluştu: ' + (error?.message || 'Bilinmeyen'), tone: 'error' } });
      window.dispatchEvent(evt);
    } catch {}
  }

  handleReload = () => {
    try { window.location.reload(); } catch {}
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '32px', maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Beklenmeyen bir hata oluştu</h2>
          <p style={{ color: '#555', marginBottom: '16px' }}>Bölüm: {this.props.name || 'Uygulama'}. Lütfen sayfayı yenileyin veya tekrar deneyin.</p>
          <pre style={{ background: '#f8f8f8', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>{String(this.state.error?.message || this.state.error || '')}</pre>
          <button onClick={this.handleReload} style={{ marginTop: '16px', background: '#2563eb', color: '#fff', padding: '10px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Sayfayı Yenile</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
