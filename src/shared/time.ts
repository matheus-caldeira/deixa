const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
export const MS_PER_DAY = 24 * SECONDS_PER_HOUR * MS_PER_SECOND;

const pad = (value: number): string => String(value).padStart(2, "0");

export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function localDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return asUtc - Math.floor(instant.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
}

export function startOfLocalDay(instant: Date, timeZone: string): Date {
  const [year, month, day] = localDateKey(instant, timeZone).split("-").map(Number);
  const utcMidnight = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
}
