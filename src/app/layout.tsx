import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/shared/app";
import { ServiceWorkerRegistration } from "@/ui/shell/service-worker";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1018" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${figtree.variable} ${jetbrains.variable}`}>
      <body>
        <div className="app">{children}</div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
