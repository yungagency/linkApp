import type { CapacitorConfig } from '@capacitor/cli'

// Même code que la PWA : `npm run cap:android` / `npm run cap:ios` génèrent les apps natives.
const config: CapacitorConfig = {
  appId: 'com.atipikgroup.linkapp',
  appName: 'LinkApp',
  webDir: 'dist',
  backgroundColor: '#0B1220',
}

export default config
