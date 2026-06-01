"use client";

import { BookOpen, FlaskConical, Globe2, Palette, Shuffle, Trophy, Zap } from "lucide-react";
import { useState } from "react";

import {
  categoryLabelsByLanguage,
  defaultQuestionPauseSeconds,
  defaultRoomSettings,
  difficultyLabelsByLanguage,
  languageLabels,
  normalQuestionTimeOptions,
  questionPauseOptions,
  scopeLabelsByLanguage,
  speedrunQuestionTimeOptions,
} from "@/lib/constants";
import { settingsCopy } from "@/lib/i18n";
import type { QuestionPauseSeconds, QuizCategory, QuizLanguage, RoomSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryIcons = {
  general: Globe2,
  science: FlaskConical,
  sports: Trophy,
  arts: Palette,
  history: BookOpen,
  random: Shuffle,
};

function questionTimeOptions(speedrunMode: boolean): readonly number[] {
  return speedrunMode ? speedrunQuestionTimeOptions : normalQuestionTimeOptions;
}

function normalizeQuestionTime(speedrunMode: boolean, seconds: number): number {
  const options = questionTimeOptions(speedrunMode);
  if (options.includes(seconds as (typeof options)[number])) {
    return seconds;
  }
  return options[0];
}

function normalizeMaxPlayers(maxPlayers: number): number {
  if (!Number.isFinite(maxPlayers)) {
    return defaultRoomSettings.maxPlayers;
  }
  return Math.max(2, Math.floor(maxPlayers));
}

function questionPauseLabel(
  copy: (typeof settingsCopy)[QuizLanguage],
  pauseSeconds: QuestionPauseSeconds,
): string {
  if (pauseSeconds === 0) {
    return copy.questionPauseNone;
  }
  if (pauseSeconds === 1.5) {
    return copy.questionPauseShort;
  }
  return copy.questionPauseLong;
}

export function RoomSettingsForm({
  initial = defaultRoomSettings,
  submitLabel,
  locale = "tr",
  busy = false,
  onSubmit,
}: {
  initial?: RoomSettings;
  submitLabel: string;
  locale?: QuizLanguage;
  busy?: boolean;
  onSubmit: (settings: RoomSettings) => Promise<void> | void;
}) {
  const [settings, setSettings] = useState({
    ...initial,
    questionTimeSeconds: normalizeQuestionTime(initial.speedrunMode, initial.questionTimeSeconds),
    questionPauseSeconds: initial.questionPauseSeconds ?? defaultQuestionPauseSeconds,
    maxPlayers: normalizeMaxPlayers(initial.maxPlayers),
  });
  const copy = settingsCopy[locale];
  const categoryLabels = categoryLabelsByLanguage[locale];
  const difficultyLabels = difficultyLabelsByLanguage[locale];
  const scopeLabels = scopeLabelsByLanguage[locale];
  const timeOptions = questionTimeOptions(settings.speedrunMode);

  function update<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }

  function toggleSpeedrun(enabled: boolean) {
    setSettings((previous) => ({
      ...previous,
      speedrunMode: enabled,
      questionTimeSeconds: normalizeQuestionTime(enabled, previous.questionTimeSeconds),
    }));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(settings);
      }}
    >
      <div>
        <p className="mb-2 text-sm font-bold">{copy.language}</p>
        <div className="flex gap-2">
          {(Object.keys(languageLabels) as RoomSettings["language"][]).map((language) => (
            <button
              key={language}
              type="button"
              className={cn(
                "rounded-full border-2 px-5 py-2.5 text-sm font-bold",
                settings.language === language
                  ? "border-primary bg-primary text-white"
                  : "border-[var(--outline)] bg-[var(--surface-raised)] text-muted",
              )}
              onClick={() => update("language", language)}
            >
              {languageLabels[language]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">{copy.category}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(categoryLabels) as QuizCategory[]).map((category) => {
            const Icon = categoryIcons[category];
            return (
              <button
                key={category}
                type="button"
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-xs font-bold",
                  settings.category === category
                    ? "border-primary bg-primary text-white shadow-md"
                    : "border-[var(--outline)] bg-[var(--surface-raised)] text-muted",
                )}
                onClick={() => update("category", category)}
              >
                <Icon size={22} />
                {categoryLabels[category]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold">{copy.difficulty}</p>
          <div className="flex rounded-xl bg-[var(--control-track)] p-1">
            {(Object.keys(difficultyLabels) as RoomSettings["difficulty"][]).map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                className={cn(
                  "flex-1 rounded-lg px-2 py-2 text-sm font-bold",
                  settings.difficulty === difficulty
                    ? "bg-[var(--control-selected)] text-primary shadow-sm"
                    : "text-muted",
                )}
                onClick={() => update("difficulty", difficulty)}
              >
                {difficultyLabels[difficulty]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">{copy.scope}</p>
          <div className="flex rounded-xl bg-[var(--control-track)] p-1">
            {(Object.keys(scopeLabels) as RoomSettings["scope"][]).map((scope) => (
              <button
                key={scope}
                type="button"
                className={cn(
                  "flex-1 rounded-lg px-2 py-2 text-sm font-bold",
                  settings.scope === scope
                    ? "bg-[var(--control-selected)] text-secondary shadow-sm"
                    : "text-muted",
                )}
                onClick={() => update("scope", scope)}
              >
                {scopeLabels[scope]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          {copy.questions}
          <select
            className="form-input mt-2"
            value={settings.questionCount}
            onChange={(event) => update("questionCount", Number(event.target.value))}
          >
            {[5, 10, 15, 20].map((count) => (
              <option key={count} value={count}>
                {count} {copy.question}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          {copy.maxPlayers}
          <input
            className="form-input mt-2"
            inputMode="numeric"
            min={2}
            step={1}
            type="number"
            value={settings.maxPlayers}
            onChange={(event) => update("maxPlayers", normalizeMaxPlayers(Number(event.target.value)))}
          />
        </label>
      </div>

      <label className="block text-sm font-bold">
        {copy.secondsPerQuestion}
        <select
          className="form-input mt-2"
          value={settings.questionTimeSeconds}
          onChange={(event) => update("questionTimeSeconds", Number(event.target.value))}
        >
          {timeOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} {copy.second}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-bold">{copy.questionPause}</p>
        <div className="flex flex-wrap gap-2">
          {questionPauseOptions.map((pauseSeconds) => (
            <button
              key={pauseSeconds}
              type="button"
              className={cn(
                "rounded-full border-2 px-5 py-2.5 text-sm font-bold",
                settings.questionPauseSeconds === pauseSeconds
                  ? "border-secondary bg-secondary text-white"
                  : "border-[var(--outline)] bg-[var(--surface-raised)] text-muted",
              )}
              onClick={() => update("questionPauseSeconds", pauseSeconds)}
            >
              {questionPauseLabel(copy, pauseSeconds)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border-2 border-[var(--outline)] bg-[var(--surface-raised)] p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-[#2170e4]"
          checked={settings.speedrunMode}
          onChange={(event) => toggleSpeedrun(event.target.checked)}
        />
        <span>
          <span className="flex items-center gap-2 font-bold text-primary-deep">
            <Zap size={16} />
            {copy.speedrunMode}
          </span>
          <span className="mt-1 block font-medium text-muted">{copy.speedrunHint}</span>
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-xl bg-[var(--surface-raised)] p-3 text-sm font-medium">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#2170e4]"
          checked={settings.isPublic}
          onChange={(event) => update("isPublic", event.target.checked)}
        />
        {copy.publicRoom}
      </label>

      <button disabled={busy} className="primary-button w-full" type="submit">
        {busy ? copy.processing : submitLabel}
      </button>
    </form>
  );
}
