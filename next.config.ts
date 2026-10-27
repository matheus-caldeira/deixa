import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { LEGACY_ROUTES } from "./src/shared/routes";

const LOOPBACK_ADDRESS = "127.0.0.1";

const localAddresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

const forDesktop = process.env.DEIXA_STANDALONE === "1";
const forWeb = process.env.DEIXA_TARGET === "web";

const nextConfig: NextConfig = {
  output: forWeb ? "export" : forDesktop ? "standalone" : undefined,
  distDir: forWeb ? ".next-web" : undefined,
  pageExtensions: forWeb ? ["web.tsx", "web.ts"] : ["tsx", "ts"],
  trailingSlash: forWeb,
  allowedDevOrigins: [...localAddresses, LOOPBACK_ADDRESS],
  logging: { serverFunctions: false },
  images: {
    unoptimized: forDesktop || forWeb,
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  redirects: forWeb ? undefined : async () => LEGACY_ROUTES.map((route) => ({ ...route, permanent: false })),
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
