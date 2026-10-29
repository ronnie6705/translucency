import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/modules/rhythm/App.css";
import "./design-system.css";
export const metadata: Metadata = {
  title: "Rhythm",
  applicationName: "Rhythm",
  description:
    "Energy-aware task planning. Build a day that respects your energy and helps you focus.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rhythm",
  },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08080d",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
