import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Doto } from "next/font/google";
import "./globals.css";
import { Boot } from "@/components/Boot";

// [css width, css height, pixel ratio] of current iPhones, portrait.
const SPLASH: [number, number, number][] = [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [414, 896, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2]];
const startupImage = SPLASH.map(([w, h, r]) => ({
  url: `/splash/${w * r}x${h * r}`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const doto = Doto({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-doto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Knock", template: "%s · Knock" },
  description: "Open the building door from your phone. Self-hosted door buzzer for your household.",
  applicationName: "Knock",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Knock", statusBarStyle: "black-translucent", startupImage },
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
