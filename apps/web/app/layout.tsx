import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kruxt-beta.vercel.app"),
  applicationName: "KRUXT",
  title: {
    default: "KRUXT | Your training has a place now",
    template: "%s | KRUXT"
  },
  description:
    "KRUXT connects training plans, proof, community, coaching, and gym operations in one mobile-first fitness platform.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KRUXT"
  },
  openGraph: {
    title: "KRUXT | Your training has a place now",
    description:
      "Plan every session, prove the work, train with your people, and keep gyms and coaches connected behind progress.",
    type: "website",
    siteName: "KRUXT"
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  themeColor: "#020915",
  colorScheme: "dark"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
