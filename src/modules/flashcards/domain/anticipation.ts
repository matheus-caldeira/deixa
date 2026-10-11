export const ANTICIPATION_BATCH = 10;

export type AnticipationStatus = {
  usedToday: number;
  upcoming: number;
  batchSize: number;
  available: boolean;
};

export function anticipationStatus(input: { usedToday: number; upcoming: number }): AnticipationStatus {
  return {
    usedToday: input.usedToday,
    upcoming: input.upcoming,
    batchSize: Math.min(ANTICIPATION_BATCH, input.upcoming),
    available: input.upcoming > 0,
  };
}
