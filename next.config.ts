import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ["*.ngrok.app", "*.ngrok-free.app", "*.ngrok.dev"],
};

export default nextConfig;
