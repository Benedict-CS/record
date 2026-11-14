import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Precached document shown when both cache and network miss.
  fallbacks: {
    document: "/offline",
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  workboxOptions: {
    disableDevLogs: true,
    // Activate new builds immediately so UI fixes are not stuck behind a
    // waiting service worker. The client detects controllerchange and shows
    // an "有新版本已就緒" banner allowing the user to reload gracefully.
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["web-push"],
};

export default withPWA(nextConfig);
