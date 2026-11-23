import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aura.secretary',
  appName: 'AURA',
  webDir: 'dist',
  server: {
    // http 오리진: Tailscale 백엔드(http) 호출 시 mixed content 차단 회피
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
