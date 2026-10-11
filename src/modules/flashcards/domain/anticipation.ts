const MS_PER_HOUR = 60 * 60 * 1000;

export const ANTICIPATION_BATCH = 10;
export const MAX_ANTICIPATIONS_PER_DAY = 5;
export const ANTICIPATION_STEP_HOURS = 1;

export type AnticipationStatus = {
  usedToday: number;
  maxPerDay: number;
  upcoming: number;
  batchSize: number;
  available: boolean;
  availableAt: Date | null;
  waitHours: number;
};

export function anticipationStatus(input: {
  anticipationsToday: readonly Date[];
  upcoming: number;
  now: Date;
}): AnticipationStatus {
  const sorted = [...input.anticipationsToday].sort((a, b) => a.getTime() - b.getTime());
  const usedToday = sorted.length;
  const last = sorted[usedToday - 1];
  const waitHours = usedToday * ANTICIPATION_STEP_HOURS;
  const availableAt = last ? new Date(last.getTime() + waitHours * MS_PER_HOUR) : null;
  const cooledDown = !availableAt || availableAt.getTime() <= input.now.getTime();
  const underLimit = usedToday < MAX_ANTICIPATIONS_PER_DAY;
  return {
    usedToday,
    maxPerDay: MAX_ANTICIPATIONS_PER_DAY,
    upcoming: input.upcoming,
    batchSize: Math.min(ANTICIPATION_BATCH, input.upcoming),
    available: underLimit && cooledDown && input.upcoming > 0,
    availableAt: underLimit && !cooledDown ? availableAt : null,
    waitHours,
  };
}
