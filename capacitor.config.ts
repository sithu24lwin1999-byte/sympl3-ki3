import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ki3.pos',
  appName: 'KI3 POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
