import type { Metadata } from "next";

import { HomeScreen } from "@/components/home-screen";
import { JsonLd } from "@/components/json-ld";
import {
  absoluteUrl,
  createWebApplicationJsonLd,
  siteConfig,
} from "@/lib/site";

export const metadata: Metadata = {
  title: siteConfig.tagline,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: absoluteUrl("/"),
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={createWebApplicationJsonLd()} />
      <HomeScreen />
    </>
  );
}
