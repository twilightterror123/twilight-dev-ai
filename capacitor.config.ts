import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.twilight.dev",
  appName: "TWILIGHT",
  webDir: "public",
  server: {
    url: process.env.TWILIGHT_APP_URL || "https://twilight-dev-ai.vercel.app",
    cleartext: false,
  },
};

export default config;
