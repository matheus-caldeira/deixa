import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/shared/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    lang: "pt-BR",
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
