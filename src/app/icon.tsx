import { ImageResponse } from "next/og";

import { brandColors, getLogoDataUrl } from "@/lib/brand-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
        <img src={logoSrc} alt="" width={26} height={26} style={{ borderRadius: 6 }} />
      </div>
    ),
    { ...size },
  );
}
