import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./influences.css";
import "@/modules/rhythm/App.css";
import "./design-system.css";
export const metadata: Metadata = {
  title: "Rhythm",
  applicationName: "Rhythm",
  description:
    "Rhythm brings reflection and energy-aware planning together. Understand what you are carrying, then plan a day that respects it.",
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
