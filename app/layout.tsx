import "./globals.css";
import { Archivo, Barlow } from "next/font/google";
import type { Metadata } from "next";

const display = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap"
});

const body = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap"
});

const SITE_URL = "https://www.dzikakaczkacatering.pl";

export function generateMetadata(): Metadata {
  const title = "Catering dietetyczny — Jastrzębie, Wodzisław, Rybnik, Żory | Dzika Kaczka";
  const description =
    "Dieta pudełkowa z restauracyjnym smakiem. Standard, keto, low carb, bez glutenu i vege od 65 zł/dzień. Dostawa pod drzwi od 19:00.";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      url: SITE_URL,
      siteName: "Dzika Kaczka Catering",
      title,
      description,
      images: [{ url: "/catering-lifestyle.jpg", width: 1200, height: 630, alt: "Dzika Kaczka Catering" }]
    },
    twitter: { card: "summary_large_image", title, description, images: ["/catering-lifestyle.jpg"] },
    robots: { index: true, follow: true }
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
