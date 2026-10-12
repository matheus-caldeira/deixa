import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const LOOPBACK_ADDRESS = "127.0.0.1";

const localAddresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...localAddresses, LOOPBACK_ADDRESS],
  logging: { serverFunctions: false },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
