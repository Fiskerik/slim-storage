export type CleanupStatus = "success" | "partial" | "failed";

export type CleanupOutcome = {
  requestedDeletes: number;
  requestedTrims: number;
  appliedDeletes: number;
  appliedTrims: number;
  freedMB: number;
  status: CleanupStatus;
};
