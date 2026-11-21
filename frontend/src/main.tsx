import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
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
    <App />
  </StrictMode>,
);
