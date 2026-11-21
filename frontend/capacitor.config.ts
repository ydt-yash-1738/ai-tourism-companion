import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.upheritage.companion',
  appName: 'UP Heritage Companion',
  webDir: 'dist',
  android: {
    // Lets the WebView call an http:// backend during local demos; production uses https
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: true,
      backgroundColor: '#0B1B33',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1B33',
      overlaysWebView: false,
    },
  },
};

export default config;
