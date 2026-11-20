import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Doto } from "next/font/google";
import "./globals.css";
import { Boot } from "@/components/Boot";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const doto = Doto({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-doto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Knock", template: "%s · Knock" },
  description: "Open the building door from your phone. Self-hosted door buzzer for your household.",
  applicationName: "Knock",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Knock", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/180", sizes: "180x180" }] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1511" },
  ],
};

/** Applies the saved theme before first paint so there is no flash. */
const THEME_BOOT = `try{var t=localStorage.getItem("knock-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme","knock-"+t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${doto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Boot />
        {children}
      </body>
    </html>
  );
}
