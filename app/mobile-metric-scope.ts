// Explicit PC / console scope must never fall through into mobile metrics.
export function isMobileMetricScope(platform: unknown, productPlatforms: string): boolean {
  const scope = String(platform || '').trim();
  if (scope) return /移动|ios|android|小游戏|mobile/i.test(scope) && !/pc|steam|console|主机/i.test(scope);
  return /移动|ios|android|小游戏|mobile/i.test(productPlatforms);
}
