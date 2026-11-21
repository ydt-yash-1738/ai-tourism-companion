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
    // Route fetch through Android's native HTTP stack: no CORS, so the app reaches
    // the deployed backend regardless of the server's allowed-origins list
    CapacitorHttp: {
      enabled: true,
    },
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
