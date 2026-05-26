import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bilgi Yarışı | Arkadaşlarınla Canlı Quiz",
    template: "%s | Bilgi Yarışı",
  },
  description:
    "AI tarafından hazırlanan sorularla arkadaşlarınla gerçek zamanlı bilgi yarışması oyna.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff7e33",
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

