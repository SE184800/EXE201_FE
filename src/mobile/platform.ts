import { Capacitor } from '@capacitor/core';
export const isMobileApp = () =>
  Capacitor.isNativePlatform() || import.meta.env.VITE_MOBILE_APP === 'true';
