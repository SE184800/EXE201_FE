import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supplymind.mobile',
  appName: 'SupplyMind AI',
  webDir: 'dist',
  server: {
    // The demo APK follows the hosted application so later Vercel updates are
    // available immediately without asking the teacher to reinstall the APK.
    url: 'https://supplymind-demo.vercel.app',
    cleartext: false,
    allowNavigation: ['supplymind-demo.vercel.app'],
  },
  android: {
    backgroundColor: '#f4f7ef',
  },
};

export default config;
