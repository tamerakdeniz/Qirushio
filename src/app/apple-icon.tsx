import { ImageResponse } from "next/og";

import { brandColors, getLogoDataUrl } from "@/lib/brand-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brandColors.background,
        }}
      >
        <img src={logoSrc} alt="" width={148} height={148} style={{ borderRadius: 32 }} />
      </div>
    ),
    { ...size },
  );
}
