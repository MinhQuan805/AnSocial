import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [];
  },
  allowedDevOrigins: ['carolyne-privileged-michele.ngrok-free.dev'],
};
export default nextConfig;
