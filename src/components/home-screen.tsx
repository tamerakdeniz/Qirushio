"use client";

import {
  ArrowRight,
  CircleHelp,
  DoorOpen,
  Gamepad2,
  LogIn,
  PlusCircle,
  Sparkles,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/brand";
import { RoomSettingsForm } from "@/components/room-settings-form";
import { ErrorNotice, Modal, Spinner } from "@/components/ui";
import { apiRequest } from "@/lib/client-api";
import { categoryLabels } from "@/lib/constants";
import { readNickname, saveNickname, saveRoomSession } from "@/lib/storage";
import type { RoomSession, RoomSummary } from "@/lib/types";
import { nicknameSchema } from "@/lib/validation";

type Dialog = "create" | "join" | "rooms" | "help" | null;

export function HomeScreen() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [nickname, setNickname] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setNickname(readNickname());
      setHydrated(true);
    });
  }, []);

  async function createRoom(settings: Parameters<typeof RoomSettingsForm>[0]["initial"]) {
    if (!settings) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ session: RoomSession }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ nickname, settings }),
      });
      saveRoomSession(result.session);
      router.push(`/room/${result.session.roomCode}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Oda oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Oda kodunu girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ session: RoomSession }>(
        `/api/rooms/${encodeURIComponent(normalizedCode)}/join`,
        { method: "POST", body: JSON.stringify({ nickname }) },
      );
      saveRoomSession(result.session);
      router.push(`/room/${result.session.roomCode}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Odaya katılınamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function browseRooms() {
    setDialog("rooms");
    setRooms(null);
    setError(null);
    try {
      const result = await apiRequest<{ rooms: RoomSummary[] }>("/api/rooms");
      setRooms(result.rooms);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Odalar alınamadı.");
      setRooms([]);
    }
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
  }

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!nickname) {
    return <NicknameEntry onComplete={setNickname} />;
  }

  return (
    <>
      <AppHeader
        action={
          <div className="flex items-center gap-2">
            <button className="ghost-button !min-h-10 !px-3 text-secondary-deep" onClick={() => setDialog("help")}>
              <CircleHelp size={20} />
              <span className="hidden sm:inline">Nasıl Oynanır?</span>
            </button>
            <button
              className="hidden rounded-full bg-white/65 px-4 py-2 text-sm font-bold text-muted sm:block"
              onClick={() => {
                saveNickname("");
                setNickname("");
              }}
            >
              {nickname}
            </button>
          </div>
        }
      />
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <section className="glass-panel grid items-center gap-7 overflow-hidden p-6 md:grid-cols-[1fr_330px] md:p-10">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/15 bg-blue-50 px-4 py-2 text-sm font-bold text-secondary-deep">
              <Sparkles size={16} />
              Her tur yeni AI soruları
            </span>
            <h1 className="max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Bilgini <span className="text-primary-deep">Yarıştır</span>, arkadaşlarını{" "}
              <span className="text-secondary-deep">Yen!</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-muted sm:text-lg">
              Bir oda kur veya davet koduyla katıl. Hızlı cevapla, canlı sıralamada zirveye çık.
            </p>
          </div>
          <div className="relative mx-auto flex h-56 w-full max-w-[300px] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-50/90 to-blue-100/80">
            <div className="absolute left-5 top-7 rounded-2xl bg-white p-3 shadow-md">
              <Timer className="text-secondary" />
            </div>
            <Image src="/assets/logo.png" alt="Bilgi Yarışı" width={174} height={174} className="drop-shadow-xl" />
            <div className="absolute bottom-7 right-5 rounded-2xl bg-white p-3 shadow-md">
              <Trophy className="text-[#ce9a00]" />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <ActionCard
            title="Oda Kur"
            description="Ayarlarını seç, bağlantıyı arkadaşlarınla paylaş."
            icon={PlusCircle}
            tone="orange"
            onClick={() => setDialog("create")}
          />
          <ActionCard
            title="Odaya Katıl"
            description="Kısa davet kodunu gir ve hemen yarışmaya başla."
            icon={LogIn}
            tone="blue"
            onClick={() => setDialog("join")}
          />
          <ActionCard
            title="Odaları Gör"
            description="Katılıma açık lobileri keşfet."
            icon={DoorOpen}
            tone="neutral"
            onClick={() => void browseRooms()}
          />
        </section>
      </main>

      <Modal open={dialog === "create"} onClose={closeDialog} title="Yeni Oda Kur" wide>
        <p className="mb-5 text-sm text-muted">Yarışma ayarlarını belirleyip arkadaşlarını lobiye davet et.</p>
        <ErrorNotice message={error} />
        <div className={error ? "mt-5" : ""}>
          <RoomSettingsForm submitLabel="Oda Kur" busy={busy} onSubmit={createRoom} />
        </div>
      </Modal>

      <Modal open={dialog === "join"} onClose={closeDialog} title="Odaya Katıl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void joinRoom(joinCode);
          }}
        >
          <p className="text-sm text-muted">
            <strong>{nickname}</strong> olarak yarışmaya katılacaksın.
          </p>
          <label className="block text-sm font-bold">
            Oda Kodu
            <input
              className="form-input mt-2 uppercase tracking-[0.25em]"
              maxLength={6}
              placeholder="ABC234"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
          </label>
          <ErrorNotice message={error} />
          <button className="primary-button w-full" disabled={busy}>
            {busy ? "Katılınıyor..." : "Katıl"}
            <ArrowRight size={18} />
          </button>
        </form>
      </Modal>

      <Modal open={dialog === "rooms"} onClose={closeDialog} title="Açık Odalar">
        <ErrorNotice message={error} />
        {rooms === null ? (
          <Spinner label="Odalar aranıyor" />
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-8 text-center">
            <Gamepad2 className="mx-auto mb-3 text-secondary" />
            <p className="font-bold">Şu an açık oda yok.</p>
            <p className="mt-1 text-sm text-muted">Yeni bir oda kurarak ilk oyunu başlatabilirsin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <button
                key={room.code}
                className="soft-panel flex w-full items-center justify-between gap-4 p-4 text-left hover:border-secondary/40"
                onClick={() => void joinRoom(room.code)}
                disabled={busy || room.playerCount >= room.maxPlayers}
              >
                <div>
                  <p className="font-extrabold text-primary-deep">{room.code}</p>
                  <p className="text-sm text-muted">
                    {categoryLabels[room.category]} · {room.questionCount} soru · {room.hostNickname}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-secondary-deep">
                  <Users size={16} />
                  {room.playerCount}/{room.maxPlayers}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <HowToPlay open={dialog === "help"} onClose={closeDialog} />
    </>
  );
}

function NicknameEntry({ onComplete }: { onComplete: (nickname: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md text-center">
        <Image src="/assets/logo.png" width={100} height={100} alt="" className="mx-auto mb-4 rounded-3xl shadow-lg" />
        <h1 className="brand-gradient text-3xl font-extrabold">Bilgi Yarışmasına Hoş Geldin!</h1>
        <p className="mb-7 mt-3 font-medium text-muted">Zekanı test etmeye ve eğlenmeye hazır mısın?</p>
        <form
          className="glass-panel space-y-4 p-6 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            const result = nicknameSchema.safeParse(value);
            if (!result.success) {
              setError(result.error.issues[0]?.message ?? "Takma ad gerekli.");
              return;
            }
            saveNickname(result.data);
            onComplete(result.data);
          }}
        >
          <label className="block text-sm font-bold">
            Takma Ad
            <input
              autoFocus
              className="form-input mt-2"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Harika bir isim seç..."
            />
          </label>
          <p className="text-xs text-muted">Bu isim bu odanın liderlik tablosunda görünecek.</p>
          <ErrorNotice message={error} />
          <button className="primary-button w-full">
            Devam Et
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof PlusCircle;
  tone: "orange" | "blue" | "neutral";
  onClick: () => void;
}) {
  const tones = {
    orange: "border-orange-100 hover:shadow-[0_12px_28px_rgba(255,126,51,0.22)] text-primary",
    blue: "border-blue-100 hover:shadow-[0_12px_28px_rgba(33,112,228,0.2)] text-secondary",
    neutral: "border-slate-200 text-muted",
  };
  return (
    <button
      className={`glass-panel min-h-48 border p-6 text-left hover:-translate-y-1 ${tones[tone]}`}
      onClick={onClick}
    >
      <span className="mb-7 inline-flex rounded-2xl bg-current/10 p-3">
        <Icon size={30} />
      </span>
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </button>
  );
}

function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nasıl Oynanır?">
      <ol className="space-y-4 text-sm text-muted">
        <Rule icon={Users} text="Takma adını seç, oda kur veya paylaşılan kodla lobiye katıl." />
        <Rule icon={Sparkles} text="Host oyunu başlatınca AI her tur için yeni sorular hazırlar." />
        <Rule icon={Timer} text="Beş seçenekten birine süre bitmeden dokun; seçimin kilitlenir." />
        <Rule icon={Trophy} text="Doğru ve hızlı cevap daha fazla puan kazandırır. Finalde cevaplarını inceleyebilirsin." />
      </ol>
    </Modal>
  );
}

function Rule({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-white/60 p-3">
      <span className="rounded-xl bg-blue-50 p-2 text-secondary">
        <Icon size={20} />
      </span>
      <span className="pt-2 font-medium">{text}</span>
    </li>
  );
}
