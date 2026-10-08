import fs from "node:fs";
import path from "node:path";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function defaultEndDate(now = new Date()) {
  const shanghaiDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const date = new Date(`${shanghaiDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDate(date);
}

export function resolveRange(endValue, days = 90, now = new Date()) {
  const end = endValue || defaultEndDate(now);
  if (!DATE_PATTERN.test(end) || Number.isNaN(Date.parse(`${end}T00:00:00Z`))) {
    throw new Error(`无效的结束日期：${end}`);
  }
  if (!Number.isInteger(days) || days < 1) throw new Error(`无效的窗口天数：${days}`);
  const startDate = new Date(`${end}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  return { start: formatDate(startDate), end, days };
}

export function chunk(items, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`无效的批次大小：${size}`);
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export function normalizeEntityName(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function queryNamesForGame(game) {
  const canonical = String(game.alias_of || game.name || "").trim();
  const preferred = String(game.databrain_query || game.en || game.name_en || game.name_cn || game.name_zh || canonical).trim();
  const values = [
    preferred,
    canonical,
    game.name,
    game.name_cn,
    game.name_zh,
    game.en,
    game.name_en,
    ...(Array.isArray(game.aliases) ? game.aliases : []),
  ].flatMap((value) => {
    const raw = String(value || "").trim();
    if (!raw) return [];
    const parts = raw.split(/\s+\/\s+|\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? [raw, ...parts] : [raw];
  });
  const seen = new Set();
  return values.map((value) => String(value || "").trim()).filter((value) => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGameEntityIndex(games) {
  const grouped = new Map();
  for (const game of games || []) {
    const canonical = String(game.alias_of || game.name || "").trim();
    const queryNames = queryNamesForGame(game);
    if (!canonical || !queryNames.length) continue;
    const current = grouped.get(canonical) || { canonical, queryName: queryNames[0], queryNames: [] };
    const seen = new Set(current.queryNames.map(normalizeEntityName));
    for (const queryName of queryNames) {
      const key = normalizeEntityName(queryName);
      if (!key || seen.has(key)) continue;
      current.queryNames.push(queryName);
      seen.add(key);
    }
    grouped.set(canonical, current);
  }

  const candidates = new Map();
  for (const entity of grouped.values()) {
    for (const name of [entity.canonical, ...entity.queryNames]) {
      const key = normalizeEntityName(name);
      if (!key) continue;
      if (!candidates.has(key)) candidates.set(key, new Set());
      candidates.get(key).add(entity.canonical);
    }
  }
  const aliases = new Map();
  for (const [key, canonicals] of candidates) {
    if (canonicals.size === 1) aliases.set(key, [...canonicals][0]);
  }
  return { entities: [...grouped.values()], aliases };
}

export function canonicalGameName(value, entityIndex) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = normalizeEntityName(raw);
  const exact = entityIndex?.aliases?.get(normalized);
  if (exact) return exact;
  const matches = new Set();
  for (const [alias, canonical] of entityIndex?.aliases || []) {
    if (alias.length >= 3 && normalized.includes(alias)) matches.add(canonical);
  }
  return matches.size === 1 ? [...matches][0] : raw;
}

export function matchesEntityEvidence(queryNames, values) {
  const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const evidence = normalize(values.join(" "));
  return queryNames.map(normalize).filter((name) => name.length >= 2).some((name) => evidence.includes(name));
}

export function isLowConfidenceEventSource(source, url) {
  const normalizedSource = String(source || "").normalize("NFKC").trim();
  const evidence = `${normalizedSource} ${url || ""}`.toLocaleLowerCase();
  if (normalizedSource.length > 40 || /^[a-z]\.?$/i.test(normalizedSource)) return true;
  if (/^(Part\s*\d+|One - WithOne AI|Telnyx Developer Docs|Indo-Pacific Defense FORUM|中国领事服务网|中公网校)$/i.test(normalizedSource) || /度假酒店|黑苹果屋|多多软件/.test(normalizedSource)) return true;
  return /91手游网|交易猫|3322软件站|多多软件站|软件下载|应用下载|下载站|手游网|游吧乐|千秋娱乐|好玩的手机游戏|9k9k|apkpure|apkfab|pp助手|豌豆荚|游戏鸟|游戏宝|当快软件园|多特游戏|3839游戏网|4399|跑跑车|攻略蜂巢|马捉老鼠网|新保罗娱乐|性感曝光|3xbz|cybrarium|baseball connected|realms rising|transfermarkt|holiday travel|gspatula|downdk\.com|dirt hub|amikin hub|\bhays\b|web[ _]?search|\/apk\/|破解版|内购版|youtube\.com\/watch\?v=(?:x+|g_9_g_9)/i.test(evidence);
}

export function isUnrelatedProductEvidence(gameName, title, summary) {
  const evidence = `${title || ""} ${summary || ""}`;
  if (gameName === "PEAK" && /高峰期|peak periods|database latency|Muse Code/i.test(evidence)) return true;
  if (gameName === "珊瑚岛" && /马尔代夫|基里巴斯|度假酒店|珊瑚岛上的死光|激光技术/.test(evidence)) return true;
  if (gameName === "WePlay" && /WePlay\s*展会|WePlay\s*Expo/i.test(evidence)) return true;
  return false;
}

export function loadTrackedGames(gamesPath) {
  const document = JSON.parse(fs.readFileSync(gamesPath, "utf8"));
  const records = Array.isArray(document.games) ? document.games : [];
  return buildGameEntityIndex(records).entities;
}

export function snapshotSummary(publicRoot) {
  const read = (name, fallback) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8"));
    } catch {
      return fallback;
    }
  };
  const trends = read("databrain_trends_90d.json", { meta: {}, games: {} });
  const metrics = read("databrain_latest_metrics.json", { meta: {}, mobile_games: {}, pc_games: {} });
  const events = read("databrain_events.json", { meta: {}, games: {} });
  const research = read("databrain_research.json", { meta: {}, games: {} });
  const attributions = read("anomaly-attributions.json", { meta: {}, games: {} });
  const trackedGames = loadTrackedGames(path.join(publicRoot, "games.json"));
  const coverageDays = (points) => {
    if (!Array.isArray(points) || points.length === 0) return 0;
    const dates = points.map((point) => point.date).filter(Boolean).sort();
    return Math.round((Date.parse(`${dates.at(-1)}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86400000) + 1;
  };
  return {
    tracked_games: trackedGames.length,
    query_range: Array.isArray(trends.meta?.query_range) ? trends.meta.query_range : [],
    metrics_query_range: Array.isArray(metrics.meta?.query_range) ? metrics.meta.query_range : [],
    trend_games: Object.keys(trends.games || {}).length,
    activity_games_80d: Object.values(trends.games || {}).filter((trend) => coverageDays(trend.activity?.points) >= 80).length,
    mobile_games: Object.keys(metrics.mobile_games || {}).length,
    pc_games: Object.keys(metrics.pc_games || {}).length,
    event_games: Object.keys(events.games || {}).length,
    event_games_queried: Number(events.meta?.games_queried || 0),
    events: Object.values(events.games || {}).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0),
    failed_event_batches: Array.isArray(events.meta?.failed_batches) ? events.meta.failed_batches.length : 0,
    research_games_queried: Number(research.meta?.games_queried || 0),
    research_games: Object.keys(research.games || {}).length,
    research_records: Object.values(research.games || {}).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0),
    research_source_counts: research.meta?.source_counts || {},
    failed_research_batches: Array.isArray(research.meta?.failed_batches) ? research.meta.failed_batches.length : 0,
    anomaly_alerts: Number(attributions.meta?.alerts || 0),
    anomaly_attributions: Number(attributions.meta?.covered_alerts || 0),
    uncovered_anomalies: Number(attributions.meta?.uncovered_alerts || 0),
  };
}

export function validateDailyRefresh(before, after, requestedRange) {
  const errors = [];
  const minimum = (value) => value > 0 ? Math.max(1, Math.floor(value * 0.9)) : 0;
  const beforeMetrics = before.mobile_games + before.pc_games;
  const afterMetrics = after.mobile_games + after.pc_games;
  if (afterMetrics < minimum(beforeMetrics)) {
    errors.push(`指标覆盖从 ${beforeMetrics} 降至 ${afterMetrics}`);
  }
  const previousEnd = before.metrics_query_range?.at(-1);
  const actualEnd = after.metrics_query_range?.at(-1);
  if (!actualEnd || actualEnd < requestedRange.start || actualEnd > requestedRange.end) {
    errors.push(`指标结束日期 ${actualEnd || "空"} 不在请求区间内`);
  }
  if (previousEnd && actualEnd && actualEnd < previousEnd) {
    errors.push(`指标结束日期从 ${previousEnd} 回退至 ${actualEnd}`);
  }
  return errors;
}

export function validateRefresh(before, after, requestedRange) {
  const errors = [];
  const minimum = (value) => value > 0 ? Math.max(1, Math.floor(value * 0.9)) : 0;
  if (after.trend_games < minimum(before.trend_games)) errors.push(`趋势覆盖从 ${before.trend_games} 降至 ${after.trend_games}`);
  if (after.activity_games_80d < minimum(before.activity_games_80d)) {
    errors.push(`80天活跃趋势覆盖从 ${before.activity_games_80d} 降至 ${after.activity_games_80d}`);
  }
  if (after.mobile_games + after.pc_games < minimum(before.mobile_games + before.pc_games)) {
    errors.push(`指标覆盖从 ${before.mobile_games + before.pc_games} 降至 ${after.mobile_games + after.pc_games}`);
  }
  if (after.failed_event_batches > 0) errors.push(`事件刷新有 ${after.failed_event_batches} 个失败批次`);
  if (after.failed_research_batches > 0) errors.push(`资料刷新有 ${after.failed_research_batches} 个失败批次`);
  if (after.event_games_queried < after.tracked_games) {
    errors.push(`事件扫描仅覆盖 ${after.event_games_queried}/${after.tracked_games} 款产品`);
  }
  if (after.research_games_queried < after.tracked_games) {
    errors.push(`研究资料扫描仅覆盖 ${after.research_games_queried}/${after.tracked_games} 款产品`);
  }
  if (after.uncovered_anomalies > 0 || after.anomaly_attributions < after.anomaly_alerts) {
    errors.push(`异动归因覆盖 ${after.anomaly_attributions}/${after.anomaly_alerts}`);
  }
  const [actualStart, actualEnd] = after.query_range;
  if (!actualEnd || actualEnd < requestedRange.start || actualEnd > requestedRange.end) {
    errors.push(`趋势结束日期 ${actualEnd || "空"} 不在请求区间内`);
  } else {
    const expectedStart = new Date(`${actualEnd}T00:00:00Z`);
    expectedStart.setUTCDate(expectedStart.getUTCDate() - ((requestedRange.windowDays || 90) - 1));
    const expectedStartValue = formatDate(expectedStart);
    if (actualStart !== expectedStartValue) errors.push(`趋势起始日期为 ${actualStart || "空"}，预期 ${expectedStartValue}`);
  }
  return errors;
}
