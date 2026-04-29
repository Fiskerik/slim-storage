import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fiskerik.trimswipe',
  appName: 'Slim',
  webDir: 'dist/client',
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#f5efe6',
    
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#f5efe6',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  server: {
    iosScheme: 'slim',
  },
};

export default config;
