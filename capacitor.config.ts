import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supplymind.mobile',
  appName: 'SupplyMind AI',
  webDir: 'dist',
  server: {
    // Bundle the mobile UI; API/uploads continue over HTTPS at the same trusted
    // origin through MobileWebViewClient, preserving HttpOnly session cookies.
    hostname: 'supplymind-demo.vercel.app',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['supplymind-demo.vercel.app'],
  },
  android: {
    backgroundColor: '#f4f7ef',
    // MainActivity handles system bars AND keyboard insets together.
    adjustMarginsForEdgeToEdge: 'disable',
  },
};

export default config;
