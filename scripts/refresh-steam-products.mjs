import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(siteRoot, "public");
const PRODUCTS = [{ name: "Dressmaker", appId: 4019220 }];

function number(text) {
  const value = Number(String(text || "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value < 0) throw new Error(`SteamCharts 数值无效：${text}`);
  return value;
}

export function parseSteamCharts(html, expectedName) {
  const $ = cheerio.load(html);
  const title = $("#app-title").text().trim();
  if (title !== expectedName) throw new Error(`SteamCharts 产品身份不匹配：${title}`);
  const row = $(".common-table tbody tr").filter((_, element) => $(element).find("td").first().text().trim() === "Last 30 Days").first();
  const columns = row.find("td").toArray().map((element) => $(element).text().trim());
  const stats = $("#app-heading .app-stat .num").toArray().map((element) => number($(element).text()));
  const observedAt = $("#app-heading abbr.timeago").first().attr("title");
  if (columns.length < 5 || stats.length < 3 || !observedAt || !Number.isFinite(Date.parse(observedAt))) {
    throw new Error("SteamCharts 近 30 日指标或快照时间缺失");
  }
  const averageCcu = number(columns[1]);
  const peakCcu = number(columns[4]);
  const historicalPeakCcu = stats[2];
  if (averageCcu <= 0 || peakCcu < averageCcu || historicalPeakCcu < peakCcu) {
    throw new Error("SteamCharts 在线人数关系异常，停止写入");
  }
  return { averageCcu, peakCcu, historicalPeakCcu, observedAt };
}

export function parseSteamReviews(document) {
  const summary = document?.query_summary;
  if (document?.success !== 1 || !summary) throw new Error("Steam 官方评价汇总不可用");
  const positive = Number(summary.total_positive);
  const negative = Number(summary.total_negative);
  const total = Number(summary.total_reviews);
  if (![positive, negative, total].every(Number.isSafeInteger) || positive < 0 || negative < 0 || total <= 0 || positive + negative !== total) {
    throw new Error("Steam 官方评价计数异常，停止写入");
  }
  return { count: total, score: Math.round(positive / total * 10000) / 100 };
}

export function completeDailyAverages(samples) {
  if (!Array.isArray(samples)) throw new Error("SteamCharts 趋势序列不是数组");
  const byDate = new Map();
  for (const sample of samples) {
    if (!Array.isArray(sample) || sample.length < 2 || !Number.isFinite(sample[0]) || !Number.isFinite(sample[1]) || sample[1] < 0) {
      throw new Error("SteamCharts 趋势点无效，停止写入");
    }
    const timestamp = new Date(sample[0]);
    if (!Number.isFinite(timestamp.getTime())) throw new Error("SteamCharts 趋势时间无效");
    const date = timestamp.toISOString().slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ time: timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60, value: sample[1] });
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([date, values]) => {
    const hours = [...new Set(values.map((item) => Math.floor(item.time)))];
    if (hours.length < 20 || Math.min(...hours) > 1 || Math.max(...hours) < 22) return [];
    return [{ date, value: Math.round(values.reduce((sum, item) => sum + item.value, 0) / values.length) }];
  });
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url} 返回 HTTP ${response.status}`);
  return response.text();
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8"));
}

function writeJson(name, document) {
  fs.writeFileSync(path.join(publicRoot, name), `${JSON.stringify(document, null, 2)}\n`);
}

export async function refreshSteamProducts() {
  const metrics = readJson("pc-metrics.json");
  const trends = readJson("pc-trends.json");
  const snapshots = await Promise.all(PRODUCTS.map(async ({ name, appId }) => {
    const chartsUrl = `https://steamcharts.com/app/${appId}`;
    const reviewsUrl = `https://store.steampowered.com/appreviews/${appId}?json=1&filter=summary&language=all&purchase_type=all&num_per_page=0`;
    const [html, chartJson, reviewsJson] = await Promise.all([
      fetchText(chartsUrl), fetchText(`${chartsUrl}/chart-data.json`), fetchText(reviewsUrl),
    ]);
    const chart = parseSteamCharts(html, name);
    const reviews = parseSteamReviews(JSON.parse(reviewsJson));
    const points = completeDailyAverages(JSON.parse(chartJson));
    if (!points.length) throw new Error(`${name} 没有完整 UTC 日的在线抽样，停止写入`);
    const date = chart.observedAt.slice(0, 10);
    const previous = metrics.games?.[name];
    if (previous?.data_date && date < previous.data_date) throw new Error(`${name} 新快照早于现有指标，停止写入`);
    return {
      name, date,
      metric: {
        average_ccu: chart.averageCcu,
        peak_ccu: chart.peakCcu,
        historical_peak_ccu: chart.historicalPeakCcu,
        revenue_30d: null,
        sales_units: null,
        reviews_count: reviews.count,
        review_score: reviews.score,
        data_date: date,
        source: "SteamCharts / Steam 官方评价",
        source_url: chartsUrl,
        confidence: "第三方统计",
        field_sources: {
          average_ccu: { date, url: chartsUrl },
          peak_ccu: { date, url: chartsUrl },
          historical_peak_ccu: { date, url: chartsUrl },
          reviews_count: { date, url: reviewsUrl },
          review_score: { date, url: reviewsUrl },
        },
        note: "近 30 日平均/峰值同时在线来自 SteamCharts；上线不足 30 天时统计窗口仅覆盖上线后。评价数与好评率来自 Steam 官方接口。收入、销量与 DAU 未获可核验数据。",
      },
      trend: {
        title: "Steam 同时在线趋势",
        start_date: points[0].date,
        end_date: points.at(-1).date,
        source: "SteamCharts",
        session_url: `${chartsUrl}/chart-data.json`,
        activity: { label: "PC 日均同时在线（抽样）", scope: "PC / Steam", granularity: "daily", points },
        revenue: { label: "PC 日收入", scope: "PC / Steam", granularity: "daily", currency: "USD", points: [], unavailable_reason: "暂无可核验的 Steam 日收入序列。" },
        note: "逐小时在线人数抽样按完整 UTC 日求均值；仅展示已返回的完整日期，不是 DAU，也不补齐缺失日期。",
      },
    };
  }));

  for (const snapshot of snapshots) {
    metrics.games[snapshot.name] = snapshot.metric;
    trends.games[snapshot.name] = snapshot.trend;
    metrics._meta.source_updates = { ...(metrics._meta.source_updates || {}), [snapshot.name]: snapshot.date };
    trends.meta.source_updates = { ...(trends.meta.source_updates || {}), [snapshot.name]: snapshot.date };
  }
  trends.meta.games = Object.keys(trends.games).length;
  writeJson("pc-metrics.json", metrics);
  writeJson("pc-trends.json", trends);
  return snapshots.map(({ name, date, metric, trend }) => ({ name, date, averageCcu: metric.average_ccu, peakCcu: metric.peak_ccu, reviews: metric.reviews_count, trendDays: trend.activity.points.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  refreshSteamProducts().then((summary) => console.log(JSON.stringify(summary, null, 2))).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
