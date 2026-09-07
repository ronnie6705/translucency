import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./influences.css";
export const metadata: Metadata = {
  title: "Translucency — A little space to understand",
  description:
    "Understand what you are carrying. Borrow a perspective. Then return to your life.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Translucency",
  },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5f1",
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
