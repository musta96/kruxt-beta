import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KRUXT",
  description: "KRUXT web app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
