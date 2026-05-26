import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Qirushio | Arkadaşlarınla Canlı Quiz",
    template: "%s | Qirushio",
  },
  description:
    "Qirushio'da AI tarafından hazırlanan sorularla arkadaşlarınla gerçek zamanlı quiz oyna.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#070d19",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
