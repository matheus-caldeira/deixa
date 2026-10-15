import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { APP_NAME } from "@/shared/app";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: t("tagline"),
    lang: await getLocale(),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E1018",
    theme_color: "#0E1018",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
