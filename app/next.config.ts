import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the same WiFi open the dev server by IP (QR watch links on /device).
  // Each * is one label of the hostname.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
