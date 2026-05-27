import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} | ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#070d19",
    theme_color: "#070d19",
    lang: siteConfig.language,
    icons: [
      {
        src: absoluteUrl(siteConfig.icon192Path),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: absoluteUrl(siteConfig.icon512Path),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: absoluteUrl(siteConfig.icon512Path),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: absoluteUrl(siteConfig.appleTouchIconPath),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
