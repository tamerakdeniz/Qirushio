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
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/brand";
import { RoomSettingsForm } from "@/components/room-settings-form";
import { ErrorNotice, Spinner } from "@/components/ui";
import { apiRequest } from "@/lib/client-api";
import { categoryLabels, difficultyLabels } from "@/lib/constants";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { readNickname, readRoomSession, removeRoomSession, saveRoomSession } from "@/lib/storage";
import type {
  AnswerReview,
  PlayerView,
  RoomSession,
  RoomSettings,
  RoomSnapshot,
  RoomView,
} from "@/lib/types";
import { cn, initials, millisecondsToSeconds } from "@/lib/utils";
import { nicknameSchema } from "@/lib/validation";

export function RoomScreen({ code }: { code: string }) {
  const [session, setSession] = useState<RoomSession | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSession(readRoomSession(code)));
  }, [code]);

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
          <Spinner label="Oda yükleniyor" />
          <ErrorNotice message={error} />
        </div>
      </main>
    );
  }

  const currentPlayer = snapshot.players.find((player) => player.id === session.playerId);
  if (!currentPlayer) {
    removeRoomSession(code);
    return <JoinRoomGate code={code} onJoined={setSession} />;
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
          />
        );
      case "generating":
        return <Generating snapshot={snapshot} />;
      case "countdown":
        return <Countdown room={snapshot.room} title="Hazır mısın?" subtitle="Oyun başlıyor" />;
      case "question":
        return (
          <Question
            snapshot={snapshot}
            choice={snapshot.myAnswer?.selectedOption ?? selectedPending}
            disabled={working === "answer" || Boolean(snapshot.myAnswer)}
            onAnswer={(option) => {
              if (snapshot.question) {
                void answer(snapshot.question.id, option);
              }
            }}
          />
        );
      case "transition":
        return <Countdown room={snapshot.room} title="Sıradaki soru" subtitle="Odaklan!" compact />;
      case "finished":
        return (
          <Results
            snapshot={snapshot}
            currentPlayer={currentPlayer}
            busy={working}
            error={error}
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
          />
        );
    }
  })();

  return <div className="min-h-screen">{content}</div>;
}

function JoinRoomGate({ code, onJoined }: { code: string; onJoined: (session: RoomSession) => void }) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            setError(parsed.error.issues[0]?.message ?? "Takma ad gerekli.");
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
            setError(reason instanceof Error ? reason.message : "Odaya katılınamadı.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Link href="/" className="ghost-button !px-0">
          <ArrowLeft size={18} /> Ana Sayfa
        </Link>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-muted">Oda Kodu</p>
          <h1 className="mt-2 text-4xl font-extrabold text-primary-deep">{code}</h1>
          <p className="mt-3 text-muted">Bu odaya katılmak için yarışmada görünecek ismini doğrula.</p>
        </div>
        <label className="block text-sm font-bold">
          Takma Ad
          <input
            className="form-input mt-2"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Harika bir isim seç..."
          />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button w-full" disabled={busy}>
          {busy ? "Katılınıyor..." : "Odaya Katıl"} <ChevronRight size={18} />
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
  onNicknameChange,
  onReady,
  onSettings,
  onStart,
}: {
  snapshot: RoomSnapshot;
  currentPlayer: PlayerView;
  onlinePlayers: Set<string>;
  busy: string | null;
  error: string | null;
  onNicknameChange: (nickname: string) => Promise<boolean>;
  onReady: (ready: boolean) => Promise<void>;
  onSettings: (settings: RoomSettings) => Promise<void>;
  onStart: () => Promise<void>;
}) {
  const room = snapshot.room;
  const allReady = snapshot.players.every((player) => player.isReady);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(currentPlayer.nickname);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  async function shareRoom() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Bilgi Yarışı", text: `Oda kodu: ${room.code}`, url });
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
          <Link className="ghost-button !min-h-10" href="/">
            <Home size={18} />
            Ana Sayfa
          </Link>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-5 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <section className="glass-panel flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Oda Kodu</p>
                <h1 className="mt-2 inline-flex rounded-xl border border-orange-200 bg-orange-50 px-5 py-2 text-4xl font-extrabold tracking-[0.14em] text-primary-deep">
                  {room.code}
                </h1>
              </div>
              <button className="secondary-button" onClick={() => void shareRoom()}>
                <Share2 size={19} /> Bağlantıyı Paylaş
              </button>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xl font-bold">Oyuncular</h2>
                <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-muted">
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
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-blue-100 font-bold text-secondary-deep">
                      {initials(player.nickname)}
                      <i
                        className={cn(
                          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                          onlinePlayers.has(player.id) ? "bg-green-500" : "bg-slate-300",
                        )}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      {player.id === currentPlayer.id && editingNickname ? (
                        <form className="flex items-center gap-1.5" onSubmit={(event) => void submitNickname(event)}>
                          <label className="sr-only" htmlFor="lobby-nickname">
                            Takma adını düzenle
                          </label>
                          <input
                            autoFocus
                            id="lobby-nickname"
                            className="min-w-0 flex-1 rounded-lg border-2 border-secondary bg-white px-2 py-1.5 text-sm font-bold outline-none"
                            maxLength={24}
                            value={nicknameDraft}
                            onChange={(event) => setNicknameDraft(event.target.value)}
                          />
                          <button
                            aria-label="Takma adı kaydet"
                            className="rounded-lg bg-secondary p-2 text-white"
                            disabled={busy !== null}
                            type="submit"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            aria-label="Düzenlemeyi iptal et"
                            className="rounded-lg bg-slate-100 p-2 text-muted"
                            disabled={busy !== null}
                            onClick={() => setEditingNickname(false)}
                            type="button"
                          >
                            <X size={15} />
                          </button>
                        </form>
                      ) : player.id === currentPlayer.id ? (
                        <button
                          aria-label={`Takma adını düzenle: ${player.nickname}`}
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
                          <Star size={12} /> Kurucu
                        </p>
                      )}
                      {player.id === currentPlayer.id && editingNickname && nicknameError && (
                        <p className="mt-1 text-xs font-medium text-red-700">{nicknameError}</p>
                      )}
                    </div>
                    {!(player.id === currentPlayer.id && editingNickname) && (
                      <span
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-bold",
                          player.isReady ? "bg-blue-600 text-white" : "bg-slate-100 text-muted",
                        )}
                      >
                        {player.isReady ? "Hazır" : "Bekliyor"}
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
                <Settings2 className="text-secondary" /> Oda Ayarları
              </h2>
              {currentPlayer.isHost ? (
                <RoomSettingsForm
                  key={`${room.category}-${room.questionCount}-${room.questionTimeSeconds}-${room.difficulty}`}
                  initial={room}
                  submitLabel="Ayarları Kaydet"
                  busy={busy === "settings"}
                  onSubmit={onSettings}
                />
              ) : (
                <RoomSettingSummary room={room} />
              )}
            </section>
            {currentPlayer.isHost ? (
              <button
                className="primary-button w-full"
                disabled={!allReady || busy !== null}
                onClick={() => void onStart()}
              >
                <Play size={20} /> {busy === "start" ? "Sorular hazırlanıyor..." : "Oyunu Başlat"}
              </button>
            ) : (
              <button
                className={currentPlayer.isReady ? "secondary-button w-full" : "primary-button w-full"}
                disabled={busy !== null}
                onClick={() => void onReady(!currentPlayer.isReady)}
              >
                <Check size={20} />
                {currentPlayer.isReady ? "Hazır Değilim" : "Hazırım"}
              </button>
            )}
            {currentPlayer.isHost && !allReady && (
              <p className="text-center text-sm font-medium text-muted">
                Başlatmak için tüm oyuncuların hazır olmasını bekleyin.
              </p>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

function RoomSettingSummary({ room }: { room: RoomView }) {
  return (
    <dl className="space-y-3 text-sm">
      {[
        ["Kategori", categoryLabels[room.category]],
        ["Soru Sayısı", `${room.questionCount} Soru`],
        ["Süre", `${room.questionTimeSeconds} Saniye`],
        ["Zorluk", difficultyLabels[room.difficulty]],
      ].map(([title, value]) => (
        <div key={title} className="soft-panel flex items-center justify-between px-4 py-3">
          <dt className="text-muted">{title}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Generating({ snapshot }: { snapshot: RoomSnapshot }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md text-center">
        <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-soft rounded-full bg-primary/20 blur-2xl" />
          <span className="animate-float relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-xl">
            <Bot size={57} className="text-primary-deep" />
          </span>
          <Star className="animate-orbit absolute inset-0 m-auto text-secondary" />
        </div>
        <h1 className="text-3xl font-extrabold">Sorular hazırlanıyor...</h1>
        <p className="mt-2 font-medium text-muted">AI bu tur için yepyeni sorular seçiyor.</p>
        <div className="glass-panel mt-8 space-y-3 p-5 text-left">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-secondary-deep">{categoryLabels[snapshot.room.category]}</span>
            <span className="text-muted">Hazırlanıyor</span>
          </div>
          <div className="progress-track">
            <div className="blue-gradient h-full w-3/4 animate-pulse-soft rounded-full" />
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-3 text-sm font-bold text-muted">
          <span className="soft-panel flex items-center gap-2 px-4 py-2">
            <Users size={16} /> {snapshot.players.length} Oyuncu
          </span>
          <span className="soft-panel flex items-center gap-2 px-4 py-2">
            <Timer size={16} /> {snapshot.room.questionTimeSeconds} sn/Soru
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
  onAnswer,
}: {
  snapshot: RoomSnapshot;
  choice: number | null;
  disabled: boolean;
  onAnswer: (option: number) => void;
}) {
  const remaining = useRemainingSeconds(snapshot.room.phaseEndsAt);
  const question = snapshot.question;
  if (!question) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-5 md:py-8">
      <header className="mb-5 flex items-center justify-between font-bold text-muted">
        <span className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-800">{question.category}</span>
        <span>
          Soru {question.position + 1} / {snapshot.room.questionCount}
        </span>
        <span className="w-16 text-right text-sm">{snapshot.answeredCount}/{snapshot.players.length}</span>
      </header>
      <div className="mb-6 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-[7px] border-orange-400 bg-white text-4xl font-extrabold tabular-nums text-primary">
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
              "flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 bg-white/90 p-4 text-left font-medium shadow-sm",
              choice === index
                ? "border-secondary bg-blue-50 font-bold shadow-[0_5px_18px_rgba(33,112,228,0.17)]"
                : "border-slate-200 hover:border-secondary/40",
            )}
            disabled={disabled || remaining === 0}
            onClick={() => onAnswer(index)}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                choice === index ? "bg-secondary text-white" : "bg-slate-100 text-muted",
              )}
            >
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </button>
        ))}
      </section>
      <footer className="mt-auto pt-7 text-center text-sm font-medium text-muted">
        {choice === null ? "Cevaplamak için bir seçeneğe dokun." : "Cevabın kilitlendi. Diğer oyuncular bekleniyor."}
      </footer>
    </main>
  );
}

function Results({
  snapshot,
  currentPlayer,
  busy,
  error,
  onReplay,
  onLobby,
}: {
  snapshot: RoomSnapshot;
  currentPlayer: PlayerView;
  busy: string | null;
  error: string | null;
  onReplay: () => Promise<void>;
  onLobby: () => Promise<void>;
}) {
  const [showReview, setShowReview] = useState(false);
  const sorted = snapshot.players;
  const topThree = sorted.slice(0, 3);

  if (showReview) {
    return (
      <Review
        room={snapshot.room}
        player={currentPlayer}
        reviews={snapshot.reviews ?? []}
        onBack={() => setShowReview(false)}
      />
    );
  }

  return (
    <>
      <AppHeader compact />
      <main className="mx-auto max-w-3xl px-4 py-7 text-center md:py-10">
        <h1 className="brand-gradient text-4xl font-extrabold">Tebrikler!</h1>
        <p className="mt-2 font-medium text-muted">İşte bu turdaki sıralamanız.</p>
        <div className="mt-8 flex items-end justify-center gap-2 sm:gap-4">
          {[topThree[1], topThree[0], topThree[2]].map((player, podiumIndex) =>
            player ? (
              <PodiumPlayer
                key={player.id}
                player={player}
                rank={podiumIndex === 1 ? 1 : podiumIndex === 0 ? 2 : 3}
              />
            ) : null,
          )}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {currentPlayer.isHost && (
            <button className="primary-button w-full" disabled={busy !== null} onClick={() => void onReplay()}>
              <RefreshCcw size={19} /> Tekrar Oyna
            </button>
          )}
          <button className="secondary-button w-full" onClick={() => setShowReview(true)}>
            <Eye size={19} /> Cevaplarımı Gör
          </button>
          {currentPlayer.isHost && (
            <button className="ghost-button w-full bg-white/55" disabled={busy !== null} onClick={() => void onLobby()}>
              <Settings2 size={18} /> Ayarlar / Odaya Dön
            </button>
          )}
          <Link className="ghost-button w-full bg-white/55" href="/">
            <Home size={18} /> Ana Sayfa
          </Link>
        </div>
        <ErrorNotice message={error} />
        <section className="glass-panel mt-8 overflow-hidden text-left">
          <h2 className="border-b border-orange-100 bg-orange-50/60 px-5 py-4 text-lg font-bold">
            Tüm Oyuncular
          </h2>
          {sorted.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0",
                player.id === currentPlayer.id && "bg-orange-50/55",
              )}
            >
              <span className="w-7 font-extrabold text-muted">{index + 1}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 font-bold text-secondary-deep">
                {initials(player.nickname)}
              </span>
              <strong className="flex-1">{player.id === currentPlayer.id ? `${player.nickname} (Sen)` : player.nickname}</strong>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{player.score} Puan</span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

function PodiumPlayer({ player, rank }: { player: PlayerView; rank: number }) {
  const heights = { 1: "h-36 bg-gradient-to-t from-yellow-400 to-yellow-100", 2: "h-28 bg-slate-100", 3: "h-24 bg-orange-100" };
  return (
    <div className={cn("flex w-28 flex-col items-center sm:w-36", rank === 1 && "-translate-y-4")}>
      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white font-bold shadow-md">
        {rank === 1 ? <Crown className="text-[#ce9a00]" /> : initials(player.nickname)}
      </span>
      <div className={cn("flex w-full flex-col justify-end rounded-t-xl p-3", heights[rank as keyof typeof heights])}>
        <Medal className="mx-auto mb-1 h-5 w-5 text-primary-deep" />
        <strong className="truncate">{player.nickname}</strong>
        <small className="font-bold text-primary-deep">{player.score} Puan</small>
      </div>
    </div>
  );
}

function Review({
  room,
  player,
  reviews,
  onBack,
}: {
  room: RoomView;
  player: PlayerView;
  reviews: AnswerReview[];
  onBack: () => void;
}) {
  const correct = reviews.filter((review) => review.isCorrect).length;
  return (
    <main className="mx-auto max-w-4xl px-4 py-5 md:py-8">
      <button className="ghost-button mb-5 !px-0" onClick={onBack}>
        <ArrowLeft size={18} /> Liderlik Tablosuna Dön
      </button>
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold">Sonuç İncelemesi</h1>
        <p className="mt-2 font-medium text-muted">Doğru cevapları ve bu turdaki performansını incele.</p>
        <div className="mt-5 inline-flex gap-3">
          <span className="soft-panel px-5 py-3 font-bold text-secondary-deep">
            Doğru <strong className="block text-3xl">{correct}/{reviews.length}</strong>
          </span>
          <span className="soft-panel px-5 py-3 font-bold text-primary-deep">
            Puan <strong className="block text-3xl">{player.score}</strong>
          </span>
        </div>
      </header>
      <section className="space-y-4">
        {reviews.map((review) => (
          <article className="glass-panel overflow-hidden !rounded-2xl" key={review.id}>
            <header className={cn("flex justify-between p-4 text-sm font-bold", review.isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
              <span>Soru {review.position + 1}</span>
              <span className="flex items-center gap-3">
                {review.timeRemainingMs === null ? (
                  "Cevap yok"
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
                        correctOption && "border-green-500 bg-green-50 text-green-800",
                        selectedWrong && "border-red-500 bg-red-50 text-red-800",
                        !correctOption && !selectedWrong && "border-slate-100 bg-white/50 text-muted",
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
                <p className="flex gap-2 rounded-xl bg-blue-50 p-3 text-sm text-secondary-deep">
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
