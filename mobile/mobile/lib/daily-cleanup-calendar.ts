export type LocalDayBounds = {
  start: Date;
  end: Date;
};

/** Returns the current device-local calendar day, including DST-safe boundaries. */
export function localDayBounds(now = new Date()): LocalDayBounds {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
