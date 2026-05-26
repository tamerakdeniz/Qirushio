export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function initials(nickname: string): string {
  return nickname
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function millisecondsToSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} sn`;
}

export function calculateScore(isCorrect: boolean, remainingTimeMs: number): number {
  return isCorrect ? Math.max(0, Math.floor(remainingTimeMs / 1000) * 10) : 0;
}

