import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kruxt-foundation-kit.vercel.app"),
  applicationName: "KRUXT",
  title: {
    default: "KRUXT",
    template: "%s | KRUXT"
  },
  description:
    "KRUXT member web app, organization workspace, and founder control plane running from a single Next.js deployment.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KRUXT"
  },
  openGraph: {
    title: "KRUXT",
    description:
      "Social fitness member experience, gym operations workspace, and founder-level control plane for KRUXT.",
    type: "website",
    siteName: "KRUXT"
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
