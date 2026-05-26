import type { Metadata, Viewport } from "next";

import "@/app/globals.css";
import { JsonLd } from "@/components/json-ld";
import { createBaseMetadata, createWebsiteJsonLd, siteConfig } from "@/lib/site";

const themeInitializer = `
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("qirushio:theme") === "light" ? "light" : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
`;

export const metadata: Metadata = createBaseMetadata();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#070d19" },
  ],
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.language} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="antialiased">
        <JsonLd data={createWebsiteJsonLd()} />
        {children}
      </body>
    </html>
  );
}
