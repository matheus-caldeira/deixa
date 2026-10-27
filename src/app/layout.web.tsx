import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP_NAME } from "@/shared/app";
import { ServiceWorkerRegistration } from "@/ui/shell/service-worker";
import { WebProviders } from "@/ui/shell/web-providers";
import "./globals.css";

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

const figtree = localFont({
  src: "./fonts/figtree.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = { title: APP_NAME, applicationName: APP_NAME };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1018" },
  ],
};

export default function WebRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${figtree.variable} ${jetbrains.variable}`}>
      <body>
        <WebProviders>
          <div className="app">{children}</div>
        </WebProviders>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
