import { ImageResponse } from "next/og";

import { brandColors, getLogoDataUrl } from "@/lib/brand-image";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${brandColors.background} 0%, #0f1f3d 52%, ${brandColors.background} 100%)`,
        }}
      >
        <img
          src={logoSrc}
          alt=""
          width={280}
          height={280}
          style={{ borderRadius: 56, marginBottom: 28 }}
        />
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: brandColors.text,
            letterSpacing: "-0.02em",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 30,
            fontWeight: 600,
            color: brandColors.accent,
          }}
        >
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
