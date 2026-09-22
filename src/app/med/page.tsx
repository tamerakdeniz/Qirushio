import type { Metadata } from "next";
import { HomeScreen } from "@/components/home-screen";

export const metadata: Metadata = {
  title: "Tıp Modu",
  description: "Tıp öğrencilerine özel bilgi yarışması. Sınıf, ders ve zorluk seçerek arkadaşlarınla birlikte çalış.",
  alternates: { canonical: "/med" },
};

export default function MedicinePage() {
  return <div data-quiz-area="medicine"><HomeScreen medical /></div>;
}
