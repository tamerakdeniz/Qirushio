"use client";

import {
  ArrowRight,
  CircleHelp,
  DoorOpen,
  Gamepad2,
  Languages,
  LogIn,
  Moon,
  PlusCircle,
  Sparkles,
  Sun,
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
import { categoryLabelsByLanguage, defaultRoomSettings } from "@/lib/constants";
import { commonCopy, homeCopy } from "@/lib/i18n";
import { readLanguage, readNickname, readTheme, saveLanguage, saveNickname, saveRoomSession, saveTheme } from "@/lib/storage";
import type { AppTheme, QuizLanguage, RoomSession, RoomSettings, RoomSummary } from "@/lib/types";
import { nicknameSchema } from "@/lib/validation";

type Dialog = "create" | "join" | "rooms" | "help" | null;

export function HomeScreen() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [nickname, setNickname] = useState("");
  const [locale, setLocale] = useState<QuizLanguage>("tr");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setNickname(readNickname());
      setLocale(readLanguage());
      setTheme(readTheme());
      setHydrated(true);
    });
  }, []);

  async function createRoom(settings: RoomSettings) {
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
      setError(reason instanceof Error ? reason.message : copy.createFailed);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError(copy.roomCodeRequired);
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
      setError(reason instanceof Error ? reason.message : copy.joinFailed);
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
      setError(reason instanceof Error ? reason.message : copy.roomsFailed);
      setRooms([]);
    }
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
  }

  function toggleLanguage() {
    const nextLocale = locale === "tr" ? "en" : "tr";
    saveLanguage(nextLocale);
    setLocale(nextLocale);
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    saveTheme(nextTheme);
    setTheme(nextTheme);
  }

  const copy = homeCopy[locale];
  const common = commonCopy[locale];
  const categoryLabels = categoryLabelsByLanguage[locale];

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!nickname) {
    return (
      <NicknameEntry
        locale={locale}
        theme={theme}
        onLanguageChange={toggleLanguage}
        onThemeChange={toggleTheme}
        onComplete={setNickname}
      />
    );
  }

  return (
    <>
      <AppHeader
        action={
          <div className="flex items-center gap-2">
            <button
              aria-label={copy.howToPlay}
              className="ghost-button !min-h-10 !px-3 text-secondary-deep"
              onClick={() => setDialog("help")}
            >
              <CircleHelp size={20} />
              <span className="hidden sm:inline">{copy.howToPlay}</span>
            </button>
            <button
              aria-label={copy.switchLanguage}
              className="ghost-button !min-h-10 !px-3 text-secondary-deep"
              onClick={toggleLanguage}
              type="button"
            >
              <Languages size={20} />
              <span className="text-xs font-extrabold uppercase">{locale === "tr" ? "EN" : "TR"}</span>
            </button>
            <button
              aria-label={theme === "dark" ? copy.switchToLight : copy.switchToDark}
              className="ghost-button !min-h-10 !px-3 text-secondary-deep"
              onClick={toggleTheme}
              type="button"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="hidden rounded-full bg-[var(--surface-raised)] px-4 py-2 text-sm font-bold text-muted sm:block"
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
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/15 bg-blue-500/15 px-4 py-2 text-sm font-bold text-secondary-deep">
              <Sparkles size={16} />
              {copy.aiBadge}
            </span>
            <h1 className="max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              {copy.heroLead} <span className="text-primary-deep">{copy.heroAccent}</span>, {copy.heroTail}{" "}
              <span className="text-secondary-deep">{copy.heroWin}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-muted sm:text-lg">
              {copy.heroDescription}
            </p>
          </div>
          <div className="relative mx-auto flex h-56 w-full max-w-[300px] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/15 to-blue-500/18">
            <div className="absolute left-5 top-7 rounded-2xl bg-[var(--surface-raised)] p-3 shadow-md">
              <Timer className="text-secondary" />
            </div>
            <Image
              src="/assets/logo.png"
              alt="Qirushio"
              width={174}
              height={174}
              unoptimized
              loading="eager"
              className="drop-shadow-xl"
            />
            <div className="absolute bottom-7 right-5 rounded-2xl bg-[var(--surface-raised)] p-3 shadow-md">
              <Trophy className="text-gold" />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <ActionCard
            title={copy.createRoom}
            description={copy.createDescription}
            icon={PlusCircle}
            tone="orange"
            onClick={() => setDialog("create")}
          />
          <ActionCard
            title={copy.joinRoom}
            description={copy.joinDescription}
            icon={LogIn}
            tone="blue"
            onClick={() => setDialog("join")}
          />
          <ActionCard
            title={copy.browseRooms}
            description={copy.browseDescription}
            icon={DoorOpen}
            tone="neutral"
            onClick={() => void browseRooms()}
          />
        </section>
      </main>

      <Modal open={dialog === "create"} onClose={closeDialog} title={copy.createTitle} closeLabel={common.close} wide>
        <p className="mb-5 text-sm text-muted">{copy.createHelp}</p>
        <ErrorNotice message={error} />
        <div className={error ? "mt-5" : ""}>
          <RoomSettingsForm
            initial={{ ...defaultRoomSettings, language: locale }}
            locale={locale}
            submitLabel={copy.createRoom}
            busy={busy}
            onSubmit={createRoom}
          />
        </div>
      </Modal>

      <Modal open={dialog === "join"} onClose={closeDialog} title={copy.joinRoom} closeLabel={common.close}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void joinRoom(joinCode);
          }}
        >
          <p className="text-sm text-muted">
            <strong>{nickname}</strong> {copy.joiningAs}
          </p>
          <label className="block text-sm font-bold">
            {copy.roomCode}
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
            {busy ? copy.joining : copy.join}
            <ArrowRight size={18} />
          </button>
        </form>
      </Modal>

      <Modal open={dialog === "rooms"} onClose={closeDialog} title={copy.openRooms} closeLabel={common.close}>
        <ErrorNotice message={error} />
        {rooms === null ? (
          <Spinner label={copy.searchingRooms} />
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface-raised)] p-8 text-center">
            <Gamepad2 className="mx-auto mb-3 text-secondary" />
            <p className="font-bold">{copy.noRooms}</p>
            <p className="mt-1 text-sm text-muted">{copy.noRoomsHelp}</p>
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
                    {categoryLabels[room.category]} · {room.questionCount} {copy.questionUnit} · {room.hostNickname}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-2 text-sm font-bold text-secondary-deep">
                  <Users size={16} />
                  {room.playerCount}/{room.maxPlayers}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <HowToPlay locale={locale} open={dialog === "help"} onClose={closeDialog} />
    </>
  );
}

function NicknameEntry({
  locale,
  theme,
  onLanguageChange,
  onThemeChange,
  onComplete,
}: {
  locale: QuizLanguage;
  theme: AppTheme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onComplete: (nickname: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = homeCopy[locale];
  const common = commonCopy[locale];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-end gap-1">
          <button className="ghost-button !min-h-10 !px-3 text-secondary-deep" onClick={onLanguageChange} type="button">
            <Languages size={19} />
            {locale === "tr" ? "EN" : "TR"}
          </button>
          <button
            aria-label={theme === "dark" ? copy.switchToLight : copy.switchToDark}
            className="ghost-button !min-h-10 !px-3 text-secondary-deep"
            onClick={onThemeChange}
            type="button"
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
        <Image
          src="/assets/logo.png"
          width={100}
          height={100}
          alt=""
          unoptimized
          loading="eager"
          className="mx-auto mb-4 rounded-3xl shadow-lg"
        />
        <h1 className="brand-gradient text-3xl font-extrabold">{copy.welcome}</h1>
        <p className="mb-7 mt-3 font-medium text-muted">{copy.welcomeDescription}</p>
        <form
          className="glass-panel space-y-4 p-6 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            const result = nicknameSchema.safeParse(value);
            if (!result.success) {
              setError(copy.nicknameRequired);
              return;
            }
            saveNickname(result.data);
            onComplete(result.data);
          }}
        >
          <label className="block text-sm font-bold">
            {common.nickname}
            <input
              autoFocus
              className="form-input mt-2"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={common.nicknamePlaceholder}
            />
          </label>
          <p className="text-xs text-muted">{copy.nicknameHelp}</p>
          <ErrorNotice message={error} />
          <button className="primary-button w-full">
            {copy.continue}
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
    orange: "border-orange-400/15 hover:shadow-[0_12px_28px_rgba(255,126,51,0.22)] text-primary",
    blue: "border-blue-400/15 hover:shadow-[0_12px_28px_rgba(33,112,228,0.2)] text-secondary",
    neutral: "border-[var(--outline)] text-muted",
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

function HowToPlay({ locale, open, onClose }: { locale: QuizLanguage; open: boolean; onClose: () => void }) {
  const copy = homeCopy[locale];
  return (
    <Modal open={open} onClose={onClose} title={copy.howToPlay} closeLabel={commonCopy[locale].close}>
      <ol className="space-y-4 text-sm text-muted">
        <Rule icon={Users} text={copy.rules[0]} />
        <Rule icon={Sparkles} text={copy.rules[1]} />
        <Rule icon={Timer} text={copy.rules[2]} />
        <Rule icon={Trophy} text={copy.rules[3]} />
      </ol>
    </Modal>
  );
}

function Rule({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-[var(--surface-raised)] p-3">
      <span className="rounded-xl bg-blue-500/15 p-2 text-secondary">
        <Icon size={20} />
      </span>
      <span className="pt-2 font-medium">{text}</span>
    </li>
  );
}
