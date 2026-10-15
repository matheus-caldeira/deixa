export type EmbeddedDatabasePhase =
  | { phase: "idle" }
  | { phase: "downloading"; percent: number | null }
  | { phase: "extracting" }
  | { phase: "initializing" }
  | { phase: "starting" }
  | { phase: "ready" }
  | { phase: "failed"; reason: string };
