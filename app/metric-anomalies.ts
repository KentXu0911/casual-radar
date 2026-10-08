export type MetricSignal = {
  metric: "DAU" | "ACU" | "日收入";
  scope: string;
  currency: string;
  source: string;
  sourceUrl: string;
  start: string;
  end: string;
  baselineStart: string;
  baselineEnd: string;
  baseline: number;
  recent: number;
  change: number;
  threshold: number;
  unusualDays: number;
  triggered: boolean;
};

const DAY = 86_400_000;
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" ? v as Record<string, unknown> : {};
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);
function dateTime(v: unknown): number {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return NaN;
  const time = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(time) && dateKey(time) === v ? time : NaN;
}

/** Compare complete calendar weeks in one series; never interpolate missing observations. */
export function evaluateMetricSeries(input: unknown, kind: "activity" | "revenue", asOf: string, productPlatform?: string, releaseDate?: string): { signal?: MetricSignal; reason?: string } {
  const trend = record(input);
  const series = record(trend[kind]);
  const label = String(series.label || "");
  const isAcu = /ACU/i.test(label) && !/DAU|MAU|CCU/i.test(label);
  const isDau = /DAU/i.test(label) && !/ACU|MAU|CCU/i.test(label);
  if (series.granularity !== "daily" || (kind === "activity" ? !isDau && !isAcu : !/日收入|daily.*revenue/i.test(label) || /累计|月|cumulative/i.test(label))) return { reason: "缺少同口径日频指标" };
  if (kind === "activity" && isAcu && (!/PC|Steam|电脑/i.test(String(series.scope || "")) || /移动|mobile/i.test(String(series.scope || "")))) return { reason: "ACU 仅纳入明确的 PC 端日频口径" };
  if (!trend.source || !series.scope || (kind === "revenue" && !series.currency)) return { reason: "指标来源或统计口径待核验" };
  if (productPlatform !== undefined) {
    const scope = String(series.scope);
    if (!productPlatform || (/移动|mobile/i.test(scope) && !/移动|iOS|Android|小游戏|mobile/i.test(productPlatform)) || (/PC|Steam/i.test(scope) && !/PC|Steam|电脑/i.test(productPlatform))) return { reason: "序列平台与产品资料不一致，待核验" };
  }
  const today = dateTime(asOf);
  if (!Number.isFinite(today)) return { reason: "观察日期无效" };
  const points = new Map<number, number>();
  const duplicates = new Set<number>();
  for (const raw of Array.isArray(series.points) ? series.points : []) {
    const point = record(raw);
    const time = dateTime(point.date);
    if (!Number.isFinite(time) || time > today || typeof point.value !== "number" || !Number.isFinite(point.value) || point.value < 0) continue;
    if (points.has(time)) duplicates.add(time);
    points.set(time, point.value);
  }
  const end = Math.max(...points.keys());
  if (!Number.isFinite(end)) return { reason: "暂无有效日频数据" };
  if (today - end > 7 * DAY) return { reason: "最新数据已超过 7 天" };
  const start = end - 34 * DAY;
  if (Number.isFinite(dateTime(releaseDate)) && dateTime(releaseDate) > start) return { reason: "上线历史不足 35 天，暂不判定" };
  const values: number[] = [];
  for (let time = start; time <= end; time += DAY) {
    if (duplicates.has(time)) return { reason: "同日存在重复记录，口径待核验" };
    const value = points.get(time);
    if (value === undefined) return { reason: "不足连续 35 天有效数据" };
    values.push(value);
  }
  const baseline = mean(values.slice(0, 28));
  if (baseline <= 0) return { reason: "历史基数为零，无法判断涨跌幅" };
  const weekly = [0, 7, 14, 21].map(i => mean(values.slice(i, i + 7)));
  const deviation = Math.sqrt(weekly.reduce((sum, value) => sum + (value - baseline) ** 2, 0) / 3);
  const recent = mean(values.slice(28));
  const change = (recent - baseline) / baseline;
  const threshold = Math.max(0.25, 3 * deviation / baseline);
  // Require at least three days to confirm the direction, using same-weekday baselines.
  const unusualDays = values.slice(28).filter((value, day) => {
    const reference = mean([0, 7, 14, 21].map(i => values[i + day]));
    return reference > 0 && (value - reference) / reference * Math.sign(change) >= 0.25;
  }).length;
  return { signal: {
    metric: kind === "activity" ? isAcu ? "ACU" : "DAU" : "日收入", scope: String(series.scope), currency: String(series.currency || ""),
    source: String(trend.source), sourceUrl: typeof trend.session_url === "string" && /^https:\/\//.test(trend.session_url) ? trend.session_url : "",
    start: dateKey(end - 6 * DAY), end: dateKey(end), baselineStart: dateKey(start), baselineEnd: dateKey(end - 7 * DAY),
    baseline, recent, change, threshold, unusualDays, triggered: Math.abs(change) >= threshold && unusualDays >= 3,
  } };
}
