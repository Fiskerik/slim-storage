export type DeleteUndoPhoto = {
  id: string;
  sizeMB: number;
};

export function undoPendingDelete<T extends DeleteUndoPhoto>(pending: T[], photo: T): { pending: T[]; restored: boolean } {
  const next = pending.filter((candidate) => candidate.id !== photo.id);
  return { pending: next, restored: next.length !== pending.length };
}

export function subtractPendingDeleteEstimate<T extends DeleteUndoPhoto>(
  session: { deleted: number; freed: number },
  photo: T,
): { deleted: number; freed: number } {
  return {
    deleted: Math.max(0, session.deleted - 1),
    freed: Math.max(0, +(session.freed - photo.sizeMB).toFixed(2)),
  };
}
