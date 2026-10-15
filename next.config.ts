import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const LOOPBACK_ADDRESS = "127.0.0.1";

const localAddresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

const forDesktop = process.env.DEIXA_STANDALONE === "1";

const nextConfig: NextConfig = {
  output: forDesktop ? "standalone" : undefined,
  allowedDevOrigins: [...localAddresses, LOOPBACK_ADDRESS],
  logging: { serverFunctions: false },
  images: {
    unoptimized: forDesktop,
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
