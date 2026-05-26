import type { Metadata } from "next";

import { RoomScreen } from "@/components/room/room-screen";
import { siteConfig } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  return {
    title: `Oda ${roomCode}`,
    description: `${siteConfig.name} oyun odası. Kod: ${roomCode}. Lobiye katıl ve arkadaşlarınla canlı quiz oyna.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomScreen code={code.toUpperCase()} />;
}
