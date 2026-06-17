import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cerebrum.skillarena",
  appName: "Cerebrum",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
