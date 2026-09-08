import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rhythm",
    short_name: "Rhythm",
    description: "Reflection and energy-aware planning, together in Rhythm.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08080d",
    theme_color: "#08080d",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
