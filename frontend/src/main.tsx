import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/600-italic.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';
import './styles/global.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native');
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: '#0B1B33' }).catch(() => undefined);
}
