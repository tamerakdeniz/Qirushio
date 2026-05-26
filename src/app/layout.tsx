import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

const themeInitializer = `
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("qirushio:theme") === "light" ? "light" : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
`;

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
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
