import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { APP_NAME } from "@/shared/app";
import { ServiceWorkerRegistration } from "@/ui/shell/service-worker";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: APP_NAME,
    description: t("tagline"),
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
    icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1018" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${bricolage.variable} ${figtree.variable} ${jetbrains.variable}`}>
      <body>
        <NextIntlClientProvider>
          <div className="app">{children}</div>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
