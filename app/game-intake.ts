export type IntakeRecord = { added_on: string; summary: string };
export function isRecentIntake(record: IntakeRecord | undefined, asOf: string): boolean {
  if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(record.added_on) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return false;
  const age = (Date.parse(asOf) - Date.parse(record.added_on)) / 86400000;
  return Number.isFinite(age) && age >= 0 && age < 7;
}
export function categoryIntakes<T extends { name: string; category?: string }>(games: T[], category: string, records: Record<string, IntakeRecord>, asOf: string): T[] {
  const seen = new Set<string>();
  return games.filter(game => {
    if (game.category !== category || seen.has(game.name) || !isRecentIntake(records[game.name], asOf)) return false;
    seen.add(game.name);
    return true;
  }).sort((a, b) => records[b.name].added_on.localeCompare(records[a.name].added_on));
}
