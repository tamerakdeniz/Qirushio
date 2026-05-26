"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Eye,
  Home,
  Medal,
  Pencil,
  Play,
  RefreshCcw,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Timer,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/brand";
import { RoomSettingsForm } from "@/components/room-settings-form";
import { ErrorNotice, Spinner } from "@/components/ui";
import { apiRequest } from "@/lib/client-api";
import { categoryLabelsByLanguage, difficultyLabelsByLanguage } from "@/lib/constants";
import { commonCopy, homeCopy, roomCopy } from "@/lib/i18n";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { readLanguage, readNickname, readRoomSession, removeRoomSession, saveRoomSession } from "@/lib/storage";
import type {
  AnswerReview,
  PlayerView,
  QuizLanguage,
  RoomSession,
  RoomSettings,
  RoomSnapshot,
  RoomView,
} from "@/lib/types";
import { cn, initials, millisecondsToSeconds } from "@/lib/utils";
import { nicknameSchema } from "@/lib/validation";

export function RoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const [session, setSession] = useState<RoomSession | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<number | null>(null);
  const [preferredLocale, setPreferredLocale] = useState<QuizLanguage>("tr");

  useEffect(() => {
    queueMicrotask(() => {
      setSession(readRoomSession(code));
      setPreferredLocale(readLanguage());
    });
  }, [code]);

  const locale = snapshot?.room.language ?? preferredLocale;
  const copy = roomCopy[locale];

  const refresh = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const nextSnapshot = await apiRequest<RoomSnapshot>(
        `/api/rooms/${encodeURIComponent(code)}/state`,
        {},
        session,
      );
      setSnapshot(nextSnapshot);
      setSelectedPending(null);
      setError(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Oda güncellenemedi.";
      if (message.includes("oturumu") || message.includes("katılın")) {
        removeRoomSession(code);
        setSession(null);
        setSnapshot(null);
      }
      setError(message);
    }
  }, [code, session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh, session]);

  useEffect(() => {
    if (!session || !snapshot?.room.id) {
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(`room:${snapshot.room.id}`, {
      config: { presence: { key: session.playerId } },
    });
    channel
      .on("broadcast", { event: "room_updated" }, () => void refresh())
      .on("presence", { event: "sync" }, () => {
        setOnlinePlayers(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ nickname: session.nickname, onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, session, snapshot?.room.id]);

  useEffect(() => {
    if (!session || !snapshot?.room.phaseEndsAt) {
      return;
    }
    const delay = Math.max(0, new Date(snapshot.room.phaseEndsAt).getTime() - Date.now() + 150);
    const timer = window.setTimeout(async () => {
      try {
        await apiRequest(
          `/api/rooms/${encodeURIComponent(code)}/advance`,
          { method: "POST", body: "{}" },
          session,
        );
        await refresh();
      } catch {
        await refresh();
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [code, refresh, session, snapshot?.room.phase, snapshot?.room.phaseEndsAt]);

  async function runAction(name: string, action: () => Promise<void>) {
    setWorking(name);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "İşlem tamamlanamadı.");
    } finally {
      setWorking(null);
    }
  }

  async function answer(questionId: string, selectedOption: number) {
    if (!session || working === "answer") {
      return;
    }
    setSelectedPending(selectedOption);
    await runAction("answer", async () => {
      await apiRequest(
        `/api/rooms/${code}/answer`,
        { method: "POST", body: JSON.stringify({ questionId, selectedOption }) },
        session,
      );
    });
  }

  const leaveRoom = useCallback(async () => {
    if (!session) {
      router.push("/");
      return;
    }
    try {
      await apiRequest(
        `/api/rooms/${encodeURIComponent(code)}/leave`,
        { method: "POST", body: "{}" },
        session,
      );
    } catch {
      // Oturum geçersiz olsa bile yerel kaydı temizleyip ana sayfaya dön.
    }
    removeRoomSession(code);
    router.push("/");
  }, [code, router, session]);

  async function updateNickname(nickname: string): Promise<boolean> {
    if (!session) {
      return false;
    }

    setWorking("nickname");
    setError(null);
    try {
      const response = await apiRequest<{ nickname: string }>(
        `/api/rooms/${code}/nickname`,
        { method: "PATCH", body: JSON.stringify({ nickname }) },
        session,
      );
      const nextSession = { ...session, nickname: response.nickname };
      saveRoomSession(nextSession);
      setSession(nextSession);
      await refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Takma ad güncellenemedi.");
      return false;
    } finally {
      setWorking(null);
    }
  }

  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <JoinRoomGate
        code={code}
        locale={locale}
        onJoined={(joinedSession) => {
          saveRoomSession(joinedSession);
          setSession(joinedSession);
        }}
      />
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel w-full max-w-md space-y-4 p-8 text-center">
          <Spinner label={copy.roomLoading} />
          <ErrorNotice message={error} />
        </div>
      </main>
    );
  }

  const currentPlayer = snapshot.players.find((player) => player.id === session.playerId);
  if (!currentPlayer) {
    removeRoomSession(code);
    return <JoinRoomGate code={code} locale={locale} onJoined={setSession} />;
  }

  const content = (() => {
    switch (snapshot.room.phase) {
      case "lobby":
        return (
          <Lobby
            snapshot={snapshot}
            currentPlayer={currentPlayer}
            onlinePlayers={onlinePlayers}
            busy={working}
            error={error}
            locale={locale}
            onNicknameChange={updateNickname}
            onReady={(isReady) =>
              runAction("ready", async () => {
                await apiRequest(
                  `/api/rooms/${code}/ready`,
                  { method: "PATCH", body: JSON.stringify({ isReady }) },
                  session,
                );
              })
            }
            onSettings={(settings) =>
              runAction("settings", async () => {
                await apiRequest(
                  `/api/rooms/${code}/settings`,
                  { method: "PATCH", body: JSON.stringify(settings) },
                  session,
                );
              })
            }
            onStart={() =>
              runAction("start", async () => {
                await apiRequest(`/api/rooms/${code}/start`, { method: "POST", body: "{}" }, session);
              })
            }
            onHome={() => leaveRoom()}
          />
        );
      case "generating":
        return <Generating locale={locale} snapshot={snapshot} />;
      case "countdown":
        return <Countdown room={snapshot.room} title={copy.readyQuestion} subtitle={copy.starts} />;
      case "question":
        return (
          <Question
            snapshot={snapshot}
            choice={snapshot.myAnswer?.selectedOption ?? selectedPending}
            disabled={working === "answer" || Boolean(snapshot.myAnswer)}
            locale={locale}
            onAnswer={(option) => {
              if (snapshot.question) {
                void answer(snapshot.question.id, option);
              }
            }}
          />
        );
      case "transition":
        return <Countdown room={snapshot.room} title={copy.nextQuestion} subtitle={copy.focus} compact />;
      case "finished":
        return (
          <Results
            snapshot={snapshot}
            currentPlayer={currentPlayer}
            busy={working}
            error={error}
            locale={locale}
            onReplay={() =>
              runAction("start", async () => {
                await apiRequest(`/api/rooms/${code}/start`, { method: "POST", body: "{}" }, session);
              })
            }
            onLobby={() =>
              runAction("lobby", async () => {
                await apiRequest(`/api/rooms/${code}/lobby`, { method: "POST", body: "{}" }, session);
              })
            }
            onHome={() => leaveRoom()}
          />
        );
    }
  })();

  return <div className="min-h-screen">{content}</div>;
}

function JoinRoomGate({
  code,
  locale,
  onJoined,
}: {
  code: string;
  locale: QuizLanguage;
  onJoined: (session: RoomSession) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = roomCopy[locale];
  const common = commonCopy[locale];

  useEffect(() => {
    queueMicrotask(() => setNickname(readNickname()));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        className="glass-panel w-full max-w-md space-y-5 p-6 sm:p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = nicknameSchema.safeParse(nickname);
          if (!parsed.success) {
            setError(copy.nicknameRequired);
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const response = await apiRequest<{ session: RoomSession }>(`/api/rooms/${code}/join`, {
              method: "POST",
              body: JSON.stringify({ nickname: parsed.data }),
            });
            saveRoomSession(response.session);
            onJoined(response.session);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : copy.joinFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Link href="/" className="ghost-button !px-0">
          <ArrowLeft size={18} /> {copy.home}
        </Link>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-muted">{copy.roomCode}</p>
          <h1 className="mt-2 text-4xl font-extrabold text-primary-deep">{code}</h1>
          <p className="mt-3 text-muted">{copy.joinDescription}</p>
        </div>
        <label className="block text-sm font-bold">
          {common.nickname}
          <input
            className="form-input mt-2"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder={common.nicknamePlaceholder}
          />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button w-full" disabled={busy}>
          {busy ? copy.joining : copy.join} <ChevronRight size={18} />
        </button>
      </form>
    </main>
  );
}

function Lobby({
  snapshot,
  currentPlayer,
  onlinePlayers,
  busy,
  error,
  locale,
  onNicknameChange,
  onReady,
  onSettings,
  onStart,
  onHome,
}: {
  snapshot: RoomSnapshot;
  currentPlayer: PlayerView;
  onlinePlayers: Set<string>;
  busy: string | null;
  error: string | null;
  locale: QuizLanguage;
  onNicknameChange: (nickname: string) => Promise<boolean>;
  onReady: (ready: boolean) => Promise<void>;
  onSettings: (settings: RoomSettings) => Promise<void>;
  onStart: () => Promise<void>;
  onHome: () => void | Promise<void>;
}) {
  const room = snapshot.room;
  const copy = roomCopy[locale];
  const allReady = snapshot.players.every((player) => player.isReady);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(currentPlayer.nickname);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  async function shareRoom() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Qirushio", text: copy.shareCode(room.code), url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  function beginNicknameEdit() {
    setNicknameDraft(currentPlayer.nickname);
    setNicknameError(null);
    setEditingNickname(true);
  }

  async function submitNickname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = nicknameSchema.safeParse(nicknameDraft);
    if (!parsed.success) {
      setNicknameError(parsed.error.issues[0]?.message ?? "Geçerli bir takma ad girin.");
      return;
    }

    const updated = await onNicknameChange(parsed.data);
    if (updated) {
      setNicknameError(null);
      setEditingNickname(false);
    }
  }

  return (
    <>
      <AppHeader
        compact
        action={
          <button type="button" className="ghost-button !min-h-10" onClick={() => void onHome()}>
            <Home size={18} />
            {copy.home}
          </button>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-5 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <section className="glass-panel flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">{copy.roomCode}</p>
                <h1 className="mt-2 inline-flex rounded-xl border border-orange-400/25 bg-orange-500/10 px-5 py-2 text-4xl font-extrabold tracking-[0.14em] text-primary-deep">
                  {room.code}
                </h1>
              </div>
              <button className="secondary-button" onClick={() => void shareRoom()}>
                <Share2 size={19} /> {copy.share}
              </button>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xl font-bold">{copy.players}</h2>
                <span className="rounded-full bg-[var(--surface-raised)] px-3 py-1 text-sm font-bold text-muted">
                  {snapshot.players.length} / {room.maxPlayers}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {snapshot.players.map((player) => (
                  <div
                    key={player.id}
                    className={cn(
                      "glass-panel flex items-center gap-3 !rounded-2xl p-4",
                      player.id === currentPlayer.id && "border-secondary/35",
                    )}
                  >
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-blue-500/20 font-bold text-secondary-deep">
                      {initials(player.nickname)}
                      <i
                        className={cn(
                          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900",
                          onlinePlayers.has(player.id) ? "bg-green-400" : "bg-slate-500",
                        )}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      {player.id === currentPlayer.id && editingNickname ? (
                        <form className="flex items-center gap-1.5" onSubmit={(event) => void submitNickname(event)}>
                          <label className="sr-only" htmlFor="lobby-nickname">
                            {copy.editNickname}
                          </label>
                          <input
                            autoFocus
                            id="lobby-nickname"
                            className="min-w-0 flex-1 rounded-lg border-2 border-secondary bg-[var(--field)] px-2 py-1.5 text-sm font-bold outline-none"
                            maxLength={24}
                            value={nicknameDraft}
                            onChange={(event) => setNicknameDraft(event.target.value)}
                          />
                          <button
                            aria-label={copy.saveNickname}
                            className="rounded-lg bg-secondary p-2 text-white"
                            disabled={busy !== null}
                            type="submit"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            aria-label={copy.cancelEdit}
                            className="rounded-lg bg-[var(--control-selected)] p-2 text-muted"
                            disabled={busy !== null}
                            onClick={() => setEditingNickname(false)}
                            type="button"
                          >
                            <X size={15} />
                          </button>
                        </form>
                      ) : player.id === currentPlayer.id ? (
                        <button
                          aria-label={`${copy.editNickname}: ${player.nickname}`}
                          className="group flex max-w-full items-center gap-1.5 text-left font-bold hover:text-secondary-deep"
                          disabled={busy !== null}
                          onClick={beginNicknameEdit}
                          type="button"
                        >
                          <span className="truncate">{player.nickname}</span>
                          <Pencil size={13} className="shrink-0 opacity-55 group-hover:opacity-100" />
                        </button>
                      ) : (
                        <p className="truncate font-bold">{player.nickname}</p>
                      )}
                      {player.isHost && (
                        <p className="flex items-center gap-1 text-xs font-bold text-secondary-deep">
                          <Star size={12} /> {copy.founder}
                        </p>
                      )}
                      {player.id === currentPlayer.id && editingNickname && nicknameError && (
                        <p className="mt-1 text-xs font-medium text-[var(--danger)]">{nicknameError}</p>
                      )}
                    </div>
                    {!(player.id === currentPlayer.id && editingNickname) && (
                      <span
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-bold",
                          player.isReady ? "bg-blue-600 text-white" : "bg-[var(--control-selected)] text-muted",
                        )}
                      >
                        {player.isReady ? copy.ready : copy.waiting}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {(room.generationError || error) && (
                <div className="mt-4">
                  <ErrorNotice message={room.generationError || error} />
                </div>
              )}
            </section>
          </div>
          <aside className="space-y-4">
            <section className="glass-panel p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Settings2 className="text-secondary" /> {copy.settings}
              </h2>
              {currentPlayer.isHost ? (
                <RoomSettingsForm
                  key={`${room.category}-${room.questionCount}-${room.questionTimeSeconds}-${room.difficulty}`}
                  initial={room}
                  locale={locale}
                  submitLabel={copy.saveSettings}
                  busy={busy === "settings"}
                  onSubmit={onSettings}
                />
              ) : (
                <RoomSettingSummary locale={locale} room={room} />
              )}
            </section>
            {currentPlayer.isHost ? (
              <button
                className="primary-button w-full"
                disabled={!allReady || busy !== null}
                onClick={() => void onStart()}
              >
                <Play size={20} /> {busy === "start" ? copy.preparing : copy.start}
              </button>
            ) : (
              <button
                className={currentPlayer.isReady ? "secondary-button w-full" : "primary-button w-full"}
                disabled={busy !== null}
                onClick={() => void onReady(!currentPlayer.isReady)}
              >
                <Check size={20} />
                {currentPlayer.isReady ? copy.notReady : copy.iAmReady}
              </button>
            )}
            {currentPlayer.isHost && !allReady && (
              <p className="text-center text-sm font-medium text-muted">
                {copy.waitingReady}
              </p>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

function RoomSettingSummary({ locale, room }: { locale: QuizLanguage; room: RoomView }) {
  const copy = roomCopy[locale];
  const categoryLabels = categoryLabelsByLanguage[locale];
  const difficultyLabels = difficultyLabelsByLanguage[locale];
  return (
    <dl className="space-y-3 text-sm">
      {[
        [copy.category, categoryLabels[room.category]],
        [copy.questionCount, `${room.questionCount} ${copy.question}`],
        [copy.duration, `${room.questionTimeSeconds} ${copy.second}`],
        [copy.difficulty, difficultyLabels[room.difficulty]],
      ].map(([title, value]) => (
        <div key={title} className="soft-panel flex items-center justify-between px-4 py-3">
          <dt className="text-muted">{title}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Generating({ locale, snapshot }: { locale: QuizLanguage; snapshot: RoomSnapshot }) {
  const copy = roomCopy[locale];
  const categoryLabels = categoryLabelsByLanguage[locale];
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md text-center">
        <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-soft rounded-full bg-primary/20 blur-2xl" />
          <span className="animate-float relative flex h-28 w-28 items-center justify-center rounded-full bg-[var(--surface-raised)] shadow-xl">
            <Bot size={57} className="text-primary-deep" />
          </span>
          <Star className="animate-orbit absolute inset-0 m-auto text-secondary" />
        </div>
        <h1 className="text-3xl font-extrabold">{copy.preparing}</h1>
        <p className="mt-2 font-medium text-muted">{copy.selecting}</p>
        <div className="glass-panel mt-8 space-y-3 p-5 text-left">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-secondary-deep">{categoryLabels[snapshot.room.category]}</span>
            <span className="text-muted">{copy.preparingStatus}</span>
          </div>
          <div className="progress-track">
            <div className="blue-gradient h-full w-3/4 animate-pulse-soft rounded-full" />
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-3 text-sm font-bold text-muted">
          <span className="soft-panel flex items-center gap-2 px-4 py-2">
            <Users size={16} /> {snapshot.players.length} {copy.playerUnit}
          </span>
          <span className="soft-panel flex items-center gap-2 px-4 py-2">
            <Timer size={16} /> {snapshot.room.questionTimeSeconds} {copy.secondsQuestion}
          </span>
        </div>
      </section>
    </main>
  );
}

function useRemainingSeconds(endsAt: string | null): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    function tick() {
      setRemaining(endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 0);
    }
    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [endsAt]);
  return remaining;
}

function Countdown({
  room,
  title,
  subtitle,
  compact = false,
}: {
  room: RoomView;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  const remaining = useRemainingSeconds(room.phaseEndsAt);
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <section className="glass-panel w-full max-w-md p-9">
        <Sparkles className="mx-auto mb-5 text-secondary" size={32} />
        <p className="text-lg font-bold text-muted">{subtitle}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{title}</h1>
        <p className={cn("mx-auto mt-8 font-extrabold tabular-nums text-primary", compact ? "text-7xl" : "text-8xl")}>
          {remaining || 1}
        </p>
      </section>
    </main>
  );
}

function Question({
  snapshot,
  choice,
  disabled,
  locale,
  onAnswer,
}: {
  snapshot: RoomSnapshot;
  choice: number | null;
  disabled: boolean;
  locale: QuizLanguage;
  onAnswer: (option: number) => void;
}) {
  const remaining = useRemainingSeconds(snapshot.room.phaseEndsAt);
  const copy = roomCopy[locale];
  const question = snapshot.question;
  if (!question) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-5 md:py-8">
      <header className="mb-5 flex items-center justify-between font-bold text-muted">
        <span className="rounded-full bg-amber-400/15 px-4 py-2 text-sm text-gold">{question.category}</span>
        <span>
          {copy.question} {question.position + 1} / {snapshot.room.questionCount}
        </span>
        <span className="w-16 text-right text-sm">{snapshot.answeredCount}/{snapshot.players.length}</span>
      </header>
      <div className="mb-6 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-[7px] border-orange-400 bg-[var(--surface-raised)] text-4xl font-extrabold tabular-nums text-primary">
          {remaining}
        </div>
      </div>
      <h1 className="glass-panel mb-5 p-6 text-center text-xl font-bold leading-8 sm:text-2xl">
        {question.prompt}
      </h1>
      <section className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={option}
            className={cn(
              "flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 bg-[var(--surface-card)] p-4 text-left font-medium shadow-sm",
              choice === index
                ? "border-secondary bg-blue-500/15 font-bold shadow-[0_5px_18px_rgba(33,112,228,0.17)]"
                : "border-[var(--outline)] hover:border-secondary/40",
            )}
            disabled={disabled || remaining === 0}
            onClick={() => onAnswer(index)}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                choice === index ? "bg-secondary text-white" : "bg-[var(--control-selected)] text-muted",
              )}
            >
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </button>
        ))}
      </section>
      <footer className="mt-auto pt-7 text-center text-sm font-medium text-muted">
        {choice === null ? copy.answerPrompt : copy.answerLocked}
      </footer>
    </main>
  );
}

function Results({
  snapshot,
  currentPlayer,
  busy,
  error,
  locale,
  onReplay,
  onLobby,
  onHome,
}: {
  snapshot: RoomSnapshot;
  currentPlayer: PlayerView;
  busy: string | null;
  error: string | null;
  locale: QuizLanguage;
  onReplay: () => Promise<void>;
  onLobby: () => Promise<void>;
  onHome: () => void | Promise<void>;
}) {
  const [showReview, setShowReview] = useState(false);
  const copy = roomCopy[locale];
  const sorted = snapshot.players;
  const topThree = sorted.slice(0, 3);

  if (showReview) {
    return (
      <Review
        room={snapshot.room}
        player={currentPlayer}
        reviews={snapshot.reviews ?? []}
        locale={locale}
        onBack={() => setShowReview(false)}
      />
    );
  }

  return (
    <>
      <AppHeader compact helpLabel={homeCopy[locale].howToPlay} />
      <main className="mx-auto max-w-3xl px-4 py-7 text-center md:py-10">
        <h1 className="brand-gradient text-4xl font-extrabold">{copy.congratulations}</h1>
        <p className="mt-2 font-medium text-muted">{copy.ranking}</p>
        <div className="mt-8 flex items-end justify-center gap-2 sm:gap-4">
          {[topThree[1], topThree[0], topThree[2]].map((player, podiumIndex) =>
            player ? (
              <PodiumPlayer
                key={player.id}
                player={player}
                rank={podiumIndex === 1 ? 1 : podiumIndex === 0 ? 2 : 3}
                pointsLabel={copy.points}
              />
            ) : null,
          )}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {currentPlayer.isHost && (
            <button className="primary-button w-full" disabled={busy !== null} onClick={() => void onReplay()}>
              <RefreshCcw size={19} /> {copy.replay}
            </button>
          )}
          <button className="secondary-button w-full" onClick={() => setShowReview(true)}>
            <Eye size={19} /> {copy.viewAnswers}
          </button>
          {currentPlayer.isHost && (
            <button className="ghost-button w-full bg-[var(--surface-raised)]" disabled={busy !== null} onClick={() => void onLobby()}>
              <Settings2 size={18} /> {copy.lobbySettings}
            </button>
          )}
          <button
            type="button"
            className="ghost-button w-full bg-[var(--surface-raised)]"
            onClick={() => void onHome()}
          >
            <Home size={18} /> {copy.home}
          </button>
        </div>
        <ErrorNotice message={error} />
        <section className="glass-panel mt-8 overflow-hidden text-left">
          <h2 className="border-b border-orange-400/15 bg-orange-500/10 px-5 py-4 text-lg font-bold">
            {copy.allPlayers}
          </h2>
          {sorted.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "flex items-center gap-4 border-b border-[var(--outline)] px-5 py-4 last:border-0",
                player.id === currentPlayer.id && "bg-orange-500/10",
              )}
            >
              <span className="w-7 font-extrabold text-muted">{index + 1}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 font-bold text-secondary-deep">
                {initials(player.nickname)}
              </span>
              <strong className="flex-1">{player.id === currentPlayer.id ? `${player.nickname} (${copy.you})` : player.nickname}</strong>
              <span className="rounded-full bg-[var(--control-selected)] px-3 py-1 text-sm font-bold">{player.score} {copy.points}</span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

function PodiumPlayer({ player, rank, pointsLabel }: { player: PlayerView; rank: number; pointsLabel: string }) {
  const heights = { 1: "h-36 bg-gradient-to-t from-yellow-500/80 to-yellow-300/25", 2: "h-28 bg-[var(--control-selected)]", 3: "h-24 bg-orange-500/20" };
  return (
    <div className={cn("flex w-28 flex-col items-center sm:w-36", rank === 1 && "-translate-y-4")}>
      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--outline)] bg-[var(--surface-raised)] font-bold shadow-md">
        {rank === 1 ? <Crown className="text-gold" /> : initials(player.nickname)}
      </span>
      <div className={cn("flex w-full flex-col justify-end rounded-t-xl p-3", heights[rank as keyof typeof heights])}>
        <Medal className="mx-auto mb-1 h-5 w-5 text-primary-deep" />
        <strong className="truncate">{player.nickname}</strong>
        <small className="font-bold text-primary-deep">{player.score} {pointsLabel}</small>
      </div>
    </div>
  );
}

function Review({
  room,
  player,
  reviews,
  locale,
  onBack,
}: {
  room: RoomView;
  player: PlayerView;
  reviews: AnswerReview[];
  locale: QuizLanguage;
  onBack: () => void;
}) {
  const correct = reviews.filter((review) => review.isCorrect).length;
  const copy = roomCopy[locale];
  return (
    <main className="mx-auto max-w-4xl px-4 py-5 md:py-8">
      <button className="ghost-button mb-5 !px-0" onClick={onBack}>
        <ArrowLeft size={18} /> {copy.backLeaderboard}
      </button>
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold">{copy.review}</h1>
        <p className="mt-2 font-medium text-muted">{copy.reviewDescription}</p>
        <div className="mt-5 inline-flex gap-3">
          <span className="soft-panel px-5 py-3 font-bold text-secondary-deep">
            {copy.correct} <strong className="block text-3xl">{correct}/{reviews.length}</strong>
          </span>
          <span className="soft-panel px-5 py-3 font-bold text-primary-deep">
            {copy.points} <strong className="block text-3xl">{player.score}</strong>
          </span>
        </div>
      </header>
      <section className="space-y-4">
        {reviews.map((review) => (
          <article className="glass-panel overflow-hidden !rounded-2xl" key={review.id}>
            <header className={cn("flex justify-between p-4 text-sm font-bold", review.isCorrect ? "bg-green-500/15 text-[var(--success)]" : "bg-red-500/15 text-[var(--danger)]")}>
              <span>{copy.question} {review.position + 1}</span>
              <span className="flex items-center gap-3">
                {review.timeRemainingMs === null ? (
                  copy.noAnswer
                ) : (
                  <>
                    <Clock3 size={15} />
                    {millisecondsToSeconds(room.questionTimeSeconds * 1000 - review.timeRemainingMs)}
                  </>
                )}
                +{review.score}P
              </span>
            </header>
            <div className="space-y-3 p-4">
              <h2 className="font-bold">{review.prompt}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {review.options.map((option, index) => {
                  const correctOption = index === review.correctOption;
                  const selectedWrong = index === review.selectedOption && !review.isCorrect;
                  return (
                    <div
                      key={option}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-3 text-sm font-medium",
                        correctOption && "border-green-500 bg-green-500/15 text-[var(--success)]",
                        selectedWrong && "border-red-500 bg-red-500/15 text-[var(--danger)]",
                        !correctOption && !selectedWrong && "border-[var(--outline)] bg-[var(--surface-raised)] text-muted",
                      )}
                    >
                      {option}
                      {correctOption && <Check size={18} />}
                      {selectedWrong && <X size={18} />}
                    </div>
                  );
                })}
              </div>
              {!review.isCorrect && (
                <p className="flex gap-2 rounded-xl bg-blue-500/15 p-3 text-sm text-secondary-deep">
                  <CircleAlert size={18} className="shrink-0" />
                  {review.explanation}
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
