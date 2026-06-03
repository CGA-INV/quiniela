import type { Metadata, Viewport } from "next";
import { Geist, Anton, JetBrains_Mono } from "next/font/google";
import { AppBackground } from "@/components/AppBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Quiniela 2026",
  title: "Quiniela Mundial 2026",
  description: "Predice los marcadores, compite con tus amigos y gana puntos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quiniela 2026",
  },
  openGraph: {
    type: "website",
    locale: "es",
    siteName: "Quiniela Mundial 2026",
    title: "Quiniela Mundial 2026",
    description: "Predice los marcadores, compite con tus amigos y gana puntos.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quiniela Mundial 2026",
    description: "Predice los marcadores, compite con tus amigos y gana puntos.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1f1c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${anton.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=arrow_forward,close,emoji_events,error,group,login,sports_soccer,volume_off,volume_up&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppBackground />
        {children}
      </body>
    </html>
  );
}
