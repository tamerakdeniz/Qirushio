import type { Metadata } from "next";

export const siteConfig = {
  name: "Qirushio",
  tagline: "Arkadaşlarınla Canlı Quiz",
  description:
    "AI ile üretilen sorularla arkadaşlarınla gerçek zamanlı quiz oyna. Oda oluştur, kodu paylaş, lobi kur ve birlikte yarış.",
  locale: "tr_TR",
  language: "tr",
  keywords: [
    "quiz",
    "bilgi yarışması",
    "multiplayer quiz",
    "arkadaşlarla quiz",
    "canlı quiz",
    "AI quiz",
    "online oyun",
    "Qirushio",
  ],
  ogImagePath: "/assets/logo.png",
  url: "http://qirushio.tamerakdeniz.com",
} as const;

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return siteConfig.url;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

export function createBaseMetadata(overrides?: Metadata): Metadata {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${siteConfig.name} | ${siteConfig.tagline}`,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: [...siteConfig.keywords],
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: siteUrl,
      siteName: siteConfig.name,
      title: `${siteConfig.name} | ${siteConfig.tagline}`,
      description: siteConfig.description,
      images: [
        {
          url: siteConfig.ogImagePath,
          width: 512,
          height: 512,
          alt: `${siteConfig.name} logosu`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteConfig.name} | ${siteConfig.tagline}`,
      description: siteConfig.description,
      images: [siteConfig.ogImagePath],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/assets/logo.png",
    },
    category: "games",
    ...overrides,
  };
}

export function createWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description: siteConfig.description,
    url: getSiteUrl(),
    inLanguage: siteConfig.language,
  };
}

export function createWebApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: getSiteUrl(),
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "TRY",
    },
    inLanguage: ["tr", "en"],
  };
}
