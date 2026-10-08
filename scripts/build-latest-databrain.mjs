import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGameEntityIndex, canonicalGameName as resolveCanonicalGameName } from "./weekly-refresh-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(siteRoot, "..");
function arg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const outputRoot = path.resolve(arg("--output-root", path.join(workspaceRoot, "outputs")));
const biRoot = path.resolve(arg("--bi-root", path.join(workspaceRoot, "bi_data")));
const publicRoot = path.resolve(arg("--public-root", path.join(siteRoot, "public")));
const gamesDocument = JSON.parse(fs.readFileSync(path.join(publicRoot, "games.json"), "utf8"));
const manifestPath = path.join(outputRoot, "databrain_latest_90d_manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
const windowDays = Number(manifest?.window_days) || 90;
let queryStart = manifest?.query_range?.[0] || "2026-05-25";
const entityIndex = buildGameEntityIndex(gamesDocument.games || []);
const trackedCanonicalNames = new Set(entityIndex.entities.map((entity) => entity.canonical));

function canonicalGameName(value) {
  const canonical = resolveCanonicalGameName(value, entityIndex);
  return trackedCanonicalNames.has(canonical) ? canonical : null;
}

function parseBiParts(document) {
  const parts = [];
  for (const event of document.events || []) {
    for (const part of event.result?.artifact?.parts || []) {
      if (part.type !== "data" || part.data?.type !== "bi_data") continue;
      const value = typeof part.data.value === "string" ? JSON.parse(part.data.value) : part.data.value;
      for (const item of Array.isArray(value) ? value : [value]) {
        const rows = item?.data?.data;
        if (Array.isArray(rows)) parts.push({ dataId: item.data_id || "latest", rows });
      }
    }
  }
  return parts;
}

function metricValue(row) {
  const value = row[row.metric] ?? row.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAggregatePlatform(platform) {
  return ["all", "全部"].includes(String(platform || "").toLowerCase());
}

function pickAggregate(rows) {
  const aggregate = rows.filter((row) => isAggregatePlatform(row.platform));
  if (aggregate.length) return metricValue(aggregate[0]);
  const byPlatform = new Map();
  for (const row of rows) {
    const key = String(row.platform || "unknown").toLowerCase();
    if (!byPlatform.has(key)) byPlatform.set(key, metricValue(row));
  }
  const values = [...byPlatform.values()].filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function pointsFor(rows, metrics, gameType, platformMode = "aggregate") {
  const byDate = new Map();
  for (const row of rows) {
    if (row.granularity !== "daily" || row.game_type !== gameType || !metrics.includes(row.metric) || row.date < queryStart) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, candidates]) => {
    for (const metric of metrics) {
      const matching = candidates.filter((row) => row.metric === metric && (platformMode !== "pc" || /^(pc|全部)$/i.test(String(row.platform || ""))));
      if (!matching.length) continue;
      const preferred = platformMode === "pc" ? matching.find((row) => /^pc$/i.test(String(row.platform || ""))) || matching.find((row) => isAggregatePlatform(row.platform)) || matching[0] : null;
      const value = preferred ? metricValue(preferred) : pickAggregate(matching);
      if (value !== null) return {
        date,
        value: Math.round(value * 100) / 100,
        metric,
        source: preferred?.source || matching[0].source,
        platform: preferred?.platform || (matching.length === 1 ? matching[0].platform : "all"),
      };
    }
    return null;
  }).filter(Boolean);
}

function monthlyPoint(rows, metric, gameType) {
  const candidates = rows.filter((row) => row.granularity === "monthly" && row.game_type === gameType && row.metric === metric).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!candidates.length) return null;
  const date = candidates.at(-1).date;
  const matching = candidates.filter((row) => row.date === date);
  const value = pickAggregate(matching);
  return value === null ? null : { date, value: Math.round(value * 100) / 100 };
}

function coverage(points) {
  if (!points.length) return { start: "", end: "", days: 0 };
  const start = points[0].date;
  const end = points.at(-1).date;
  return { start, end, days: Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1 };
}

function trailing(points, days = 30) {
  if (!points.length) return [];
  const end = Date.parse(`${points.at(-1).date}T00:00:00Z`);
  const start = end - (days - 1) * 86400000;
  return points.filter((point) => Date.parse(`${point.date}T00:00:00Z`) >= start);
}

const rowsByGame = new Map();
const sessionsByGame = new Map();
const sessionMeta = [];
const allRowDates = [];

if (manifest?.batches?.some((batch) => batch.status !== "complete")) {
  throw new Error("DataBrain 指标批次尚未全部完成，已停止生成公开快照。");
}
const sourcePaths = manifest?.batches?.length
  ? manifest.batches.map((batch) => path.join(outputRoot, batch.file))
  : fs.readdirSync(outputRoot)
      .filter((name) => /^databrain_latest_90d_batch\d+\.json$/.test(name))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]))
      .map((name) => path.join(outputRoot, name));
if (!sourcePaths.length) throw new Error("没有找到 DataBrain 指标批次文件。");

for (const sourcePath of sourcePaths) {
  const document = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  for (const part of parseBiParts(document)) {
    const sessionDir = path.join(biRoot, document.sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const jsonlPath = path.join(sessionDir, `${part.dataId}.jsonl`);
    fs.writeFileSync(jsonlPath, `${part.rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
    const dates = part.rows.map((row) => row.date).filter(Boolean).sort();
    const meta = {
      sessionId: document.sessionId,
      data_id: part.dataId,
      rows: part.rows.length,
      fields: [...new Set(part.rows.flatMap((row) => Object.keys(row)))].sort(),
      time_range: dates.length ? [dates[0], dates.at(-1)] : [],
      system_url: document.system_url,
      file: path.relative(workspaceRoot, jsonlPath),
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(path.join(sessionDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
    sessionMeta.push(meta);
    for (const row of part.rows) {
      if (row.date) allRowDates.push(row.date);
      const canonical = canonicalGameName(row.game_name);
      if (!canonical) continue;
      if (!rowsByGame.has(canonical)) rowsByGame.set(canonical, []);
      rowsByGame.get(canonical).push(row);
      sessionsByGame.set(canonical, document.system_url);
    }
  }
}

const latestRowDate = allRowDates.sort().at(-1);
if (latestRowDate) {
  const startDate = new Date(`${latestRowDate}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));
  queryStart = startDate.toISOString().slice(0, 10);
}

const trends = {};
const pcTrends = {};
const mobileMetrics = {};
const pcMetrics = {};

for (const [game, rows] of [...rowsByGame.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"))) {
  const mobileActivity = pointsFor(rows, ["dau"], "mobile");
  const mobileRevenue = pointsFor(rows, ["revenue_daily"], "mobile");
  const pcActivity = pointsFor(rows, ["alinea__acu"], "pc/console", "pc");
  const pcRevenue = pointsFor(rows, ["alinea__est_revenue", "databrain__total_revenue_daily"], "pc/console", "pc");
  if (pcActivity.length || pcRevenue.length) {
    const points = [...pcActivity, ...pcRevenue].sort((a,b) => a.date.localeCompare(b.date));
    pcTrends[game] = {
      start_date: points[0].date, end_date: points.at(-1).date,
      source: "DataBrain / Alinea", session_url: sessionsByGame.get(game),
      activity: { label: "PC 日均 ACU", scope: "PC / Steam", granularity: "daily", points: pcActivity.map(({date,value})=>({date,value})) },
      revenue: { label: "PC 日收入", scope: "PC / Steam", granularity: "daily", currency: "USD", points: pcRevenue.map(({date,value})=>({date,value})) },
      note: "PC / Steam 日频第三方估算（USD）；缺失日期不插值，收入不等于利润。"
    };
  }
  const useMobile = mobileActivity.length > 0 || (mobileRevenue.length > 0 && pcActivity.length === 0);
  const activity = useMobile ? mobileActivity : pcActivity;
  const revenue = useMobile ? mobileRevenue : pcRevenue;
  const allPoints = [...activity, ...revenue].sort((a, b) => a.date.localeCompare(b.date));
  if (allPoints.length) {
    const activityMetric = activity[0]?.metric;
    const activityLabel = useMobile ? "DAU" : activityMetric === "alinea__acu" ? "PC 日均 ACU" : "PC/主机 DAU";
    const mobilePlatforms = [...new Set([...mobileActivity, ...mobileRevenue].map((point) => String(point.platform || "").toLowerCase()).filter(Boolean))];
    const scope = useMobile
      ? mobilePlatforms.length === 1 && mobilePlatforms[0] === "appstore" ? "移动端 App Store 全球" : "移动端全球"
      : "PC / Steam 全球";
    trends[game] = {
      start_date: allPoints[0].date,
      end_date: allPoints.at(-1).date,
      source: [...new Set(allPoints.map((point) => point.source).filter(Boolean))].join(" / "),
      session_url: sessionsByGame.get(game),
      activity: {
        label: activityLabel,
        scope,
        granularity: "daily",
        points: activity.map(({ date, value }) => ({ date, value })),
        ...(!activity.length ? { unavailable_reason: "DataBrain 当前无可核验的近三个月日频活跃序列。" } : {})
      },
      revenue: {
        label: useMobile ? "日收入" : "PC 日收入",
        scope,
        granularity: "daily",
        currency: "USD",
        points: revenue.map(({ date, value }) => ({ date, value })),
        ...(!revenue.length ? { unavailable_reason: "DataBrain 当前无可核验的近三个月日收入序列。" } : {})
      },
      note: "DataBrain 日频第三方预估；缺失日期不插值。收入不含广告变现。"
    };
  }

  if (mobileActivity.length) {
    const latestDau = mobileActivity.at(-1);
    const latestMau = monthlyPoint(rows, "mau", "mobile");
    const revenueWindow = trailing(mobileRevenue);
    mobileMetrics[game] = {
      platform: "mobile",
      dau: Math.round(latestDau.value),
      mau: latestMau ? Math.round(latestMau.value) : null,
      monthly_revenue: revenueWindow.length >= 20 ? Math.round(revenueWindow.reduce((sum, point) => sum + point.value, 0)) : null,
      dau_data_date: latestDau.date,
      mau_data_date: latestMau?.date || null,
      revenue_data_date: revenueWindow.at(-1)?.date || null,
      data_date: latestDau.date,
      source: "DataBrain / Sensor Tower",
      source_url: sessionsByGame.get(game),
      note: "DAU 为最新日频值；MAU 为最新可用自然月；收入为最新 30 个日历日内可用日收入之和。"
    };
  }

  if (pcActivity.length) {
    const activityWindow = trailing(pcActivity);
    const pcuPoints = pointsFor(rows, ["alinea__pcu"], "pc/console", "pc");
    const pcuWindow = trailing(pcuPoints);
    const revenueWindow = trailing(pcRevenue);
    pcMetrics[game] = {
      average_ccu: activityWindow.length ? Math.round(activityWindow.reduce((sum, point) => sum + point.value, 0) / activityWindow.length) : null,
      peak_ccu: pcuWindow.length ? Math.round(Math.max(...pcuWindow.map((point) => point.value))) : null,
      revenue_30d: revenueWindow.length >= 20 ? Math.round(revenueWindow.reduce((sum, point) => sum + point.value, 0)) : null,
      data_date: pcActivity.at(-1).date,
      source: [...new Set([...pcActivity, ...pcRevenue].map((point) => point.source).filter(Boolean))].join(" / "),
      source_url: sessionsByGame.get(game),
      confidence: "第三方估算",
      note: "近 30 日指标由 DataBrain 返回的日频第三方序列聚合；缺失日期不插值。"
    };
  }
}

const queryEnd = sessionMeta.flatMap((item) => item.time_range || []).sort().at(-1) || queryStart;

const trendResult = {
  meta: {
    updated: new Date().toISOString(),
    query_range: [queryStart, queryEnd],
    granularity: "daily",
    games_with_trends: Object.keys(trends).length,
    games_with_90d_activity: Object.values(trends).filter((trend) => coverage(trend.activity.points).days >= 90).length,
    games_with_80d_activity: Object.values(trends).filter((trend) => coverage(trend.activity.points).days >= 80).length,
    coverage_policy: "Only verified source rows are included; missing metrics and dates are not interpolated.",
    sessions: sessionMeta
  },
  games: trends
};

const metricResult = {
  meta: {
    updated: new Date().toISOString(),
    mobile_games: Object.keys(mobileMetrics).length,
    pc_games: Object.keys(pcMetrics).length,
    query_range: [queryStart, queryEnd],
    sessions: [...new Set(sessionMeta.map((item) => item.system_url))]
  },
  mobile_games: mobileMetrics,
  pc_games: pcMetrics
};

const metricsOnly = process.argv.includes("--metrics-only");
const mergeExisting = process.argv.includes("--merge");
const readPublic = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8")); } catch { return fallback; }
};

if (mergeExisting) {
  const existingTrends = readPublic("databrain_trends_90d.json", { meta: {}, games: {} });
  const trendCompleteness = (trend) => {
    const activity = Array.isArray(trend?.activity?.points) ? trend.activity.points.length : 0;
    const revenue = Array.isArray(trend?.revenue?.points) ? trend.revenue.points.length : 0;
    return activity + revenue;
  };
  const mergedTrends = { ...(existingTrends.games || {}) };
  for (const [game, refreshed] of Object.entries(trendResult.games)) {
    const previous = mergedTrends[game];
    mergedTrends[game] = !previous || trendCompleteness(refreshed) >= trendCompleteness(previous) ? refreshed : previous;
  }
  trendResult.games = mergedTrends;
  trendResult.meta = {
    ...existingTrends.meta,
    query_range: [queryStart, queryEnd],
    updated: new Date().toISOString(),
    games_with_trends: Object.keys(trendResult.games).length,
    games_with_90d_activity: Object.values(trendResult.games).filter((trend) => coverage(trend.activity?.points || []).days >= 90).length,
    games_with_80d_activity: Object.values(trendResult.games).filter((trend) => coverage(trend.activity?.points || []).days >= 80).length,
    sessions: [...(existingTrends.meta?.sessions || []), ...sessionMeta],
    targeted_refresh: { games: Object.keys(trends), source_query_range: [queryStart, queryEnd] },
  };

  const existingMetrics = readPublic("databrain_latest_metrics.json", { meta: {}, mobile_games: {}, pc_games: {} });
  metricResult.mobile_games = { ...(existingMetrics.mobile_games || {}), ...metricResult.mobile_games };
  metricResult.pc_games = { ...(existingMetrics.pc_games || {}), ...metricResult.pc_games };
  metricResult.meta = {
    ...existingMetrics.meta,
    query_range: [queryStart, queryEnd],
    updated: new Date().toISOString(),
    mobile_games: Object.keys(metricResult.mobile_games).length,
    pc_games: Object.keys(metricResult.pc_games).length,
    sessions: [...new Set([...(existingMetrics.meta?.sessions || []), ...sessionMeta.map((item) => item.system_url)])],
    targeted_refresh: { games: [...new Set([...Object.keys(mobileMetrics), ...Object.keys(pcMetrics)])], source_query_range: [queryStart, queryEnd] },
  };
}

if (!metricsOnly) {
  const existingPcTrends = mergeExisting ? readPublic("pc-trends.json", { meta: {}, games: {} }) : { meta: {}, games: {} };
  const pcTrendCompleteness = (trend) => (Array.isArray(trend?.activity?.points) ? trend.activity.points.length : 0) + (Array.isArray(trend?.revenue?.points) ? trend.revenue.points.length : 0);
  const mergedPcTrends = mergeExisting ? { ...(existingPcTrends.games || {}) } : pcTrends;
  if (mergeExisting) for (const [game, refreshed] of Object.entries(pcTrends)) {
    const previous = mergedPcTrends[game];
    mergedPcTrends[game] = !previous || pcTrendCompleteness(refreshed) >= pcTrendCompleteness(previous) ? refreshed : previous;
  }
  fs.writeFileSync(path.join(publicRoot, "pc-trends.json"), `${JSON.stringify({ meta: mergeExisting ? { ...existingPcTrends.meta, query_range: [queryStart, queryEnd], games: Object.keys(mergedPcTrends).length } : { query_range: [queryStart, queryEnd], games: Object.keys(mergedPcTrends).length }, games: mergedPcTrends }, null, 2)}\n`);
}
if (!process.argv.includes("--pc-only")) {
  if (!metricsOnly) fs.writeFileSync(path.join(publicRoot, "databrain_trends_90d.json"), `${JSON.stringify(trendResult, null, 2)}\n`);
  fs.writeFileSync(path.join(publicRoot, "databrain_latest_metrics.json"), `${JSON.stringify(metricResult, null, 2)}\n`);
}

const requestedGames = (gamesDocument.games || []).map((game) => game.name);
const covered = new Set([...Object.keys(trends), ...Object.keys(mobileMetrics), ...Object.keys(pcMetrics)]);
console.log(JSON.stringify({
  trends: Object.keys(trends).length,
  activity90d: trendResult.meta.games_with_90d_activity,
  mobileSnapshots: Object.keys(mobileMetrics).length,
  pcSnapshots: Object.keys(pcMetrics).length,
  unmatchedReturnedNames: [...new Set(sessionMeta.flatMap(() => []))],
  uncoveredRequested: requestedGames.filter((name) => !covered.has(name))
}, null, 2));
