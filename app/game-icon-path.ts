export function resolveGameIconPath(name: string, configured: string | undefined, supplemental: Record<string, { path: string }>) {
  return configured && !configured.includes('/placeholder-') ? configured : supplemental[name]?.path || configured;
}
