const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

export function formatDuration(ms: number): string {
  const total = Math.round(ms / MS_PER_SECOND);
  const seconds = total % SECONDS_PER_MINUTE;
  return `${Math.floor(total / SECONDS_PER_MINUTE)}:${String(seconds).padStart(2, "0")}`;
}
