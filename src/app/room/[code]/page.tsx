import type { Metadata } from "next";

import { RoomScreen } from "@/components/room/room-screen";

export const metadata: Metadata = {
  title: "Oyun Odası",
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomScreen code={code.toUpperCase()} />;
}

