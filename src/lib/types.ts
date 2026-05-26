export type RoomPhase =
  | "lobby"
  | "generating"
  | "countdown"
  | "question"
  | "transition"
  | "finished";

export type QuizLanguage = "tr" | "en";
export type QuizCategory = "general" | "science" | "sports" | "arts" | "history";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizScope = "global" | "local";

export interface RoomSettings {
  language: QuizLanguage;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  scope: QuizScope;
  questionCount: number;
  questionTimeSeconds: number;
  isPublic: boolean;
}

export interface RoomSummary extends RoomSettings {
  code: string;
  playerCount: number;
  maxPlayers: number;
  hostNickname: string;
}

export interface RoomView extends RoomSettings {
  id: string;
  code: string;
  phase: RoomPhase;
  hostPlayerId: string;
  maxPlayers: number;
  roundNumber: number;
  currentQuestionIndex: number;
  phaseEndsAt: string | null;
  generationError: string | null;
}

export interface PlayerView {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
}

export interface QuestionView {
  id: string;
  position: number;
  category: string;
  prompt: string;
  options: string[];
}

export interface CurrentAnswer {
  selectedOption: number;
}

export interface AnswerReview extends QuestionView {
  correctOption: number;
  explanation: string;
  selectedOption: number | null;
  isCorrect: boolean;
  score: number;
  timeRemainingMs: number | null;
}

export interface RoomSnapshot {
  serverNow: string;
  room: RoomView;
  players: PlayerView[];
  question: QuestionView | null;
  myAnswer: CurrentAnswer | null;
  answeredCount: number;
  reviews: AnswerReview[] | null;
}

export interface RoomSession {
  roomCode: string;
  playerId: string;
  playerToken: string;
  nickname: string;
}

export interface GeneratedQuestion {
  category: string;
  prompt: string;
  options: [string, string, string, string, string];
  correctOption: number;
  explanation: string;
}

