import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  name?: string;
  texts?: ErrorBoundaryTexts;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

type SupportedLanguage = 'tr' | 'en' | 'fr' | 'de';

interface ErrorBoundaryTexts {
  title: string;
  message: (section: string) => string;
  actionLabel: string;
  defaultSectionLabel: string;
}

const TEXT_DICTIONARY: Record<SupportedLanguage, ErrorBoundaryTexts> = {
  tr: {
    title: 'Beklenmeyen bir hata oluştu',
    message: section => `Bölüm: ${section}. Lütfen sayfayı yenileyin veya tekrar deneyin.`,
    actionLabel: 'Sayfayı Yenile',
    defaultSectionLabel: 'Uygulama',
  },
  en: {
    title: 'An unexpected error occurred',
    message: section => `Section: ${section}. Please refresh the page or try again.`,
    actionLabel: 'Refresh Page',
    defaultSectionLabel: 'Application',
  },
  fr: {
    title: 'Une erreur inattendue est survenue',
    message: section => `Section : ${section}. Veuillez actualiser la page ou réessayer.`,
    actionLabel: 'Actualiser la page',
    defaultSectionLabel: 'Application',
  },
  de: {
    title: 'Ein unerwarteter Fehler ist aufgetreten',
    message: section => `Bereich: ${section}. Bitte laden Sie die Seite neu oder versuchen Sie es erneut.`,
    actionLabel: 'Seite neu laden',
    defaultSectionLabel: 'Anwendung',
  },
};

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
      const texts = this.props.texts ?? TEXT_DICTIONARY.tr;
      const sectionLabel = this.props.name || texts.defaultSectionLabel;
      return this.props.fallback || (
        <div style={{ padding: '32px', maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>{texts.title}</h2>
          <p style={{ color: '#555', marginBottom: '16px' }}>{texts.message(sectionLabel)}</p>
          <pre style={{ background: '#f8f8f8', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>{String(this.state.error?.message || this.state.error || '')}</pre>
          <button onClick={this.handleReload} style={{ marginTop: '16px', background: '#2563eb', color: '#fff', padding: '10px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>{texts.actionLabel}</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LocalizedErrorBoundary: React.FC<ErrorBoundaryProps> = ({ texts, ...rest }) => {
  const { currentLanguage } = useLanguage();
  const localeTexts = texts ?? TEXT_DICTIONARY[(currentLanguage as SupportedLanguage)] ?? TEXT_DICTIONARY.tr;
  return <ErrorBoundary {...rest} texts={localeTexts} />;
};

export default LocalizedErrorBoundary;
