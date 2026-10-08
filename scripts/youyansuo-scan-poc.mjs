import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(decodeURIComponent(new URL("..", import.meta.url).pathname));
const WORKSPACE_ROOT = path.resolve(ROOT, "..");
const SITE = "https://ai.xianjianwendao.com";
const RUN_DATE = "2026-09-24";
const OUTPUT_JSON = path.join(WORKSPACE_ROOT, "outputs", "youyansuo_game_scan_poc_2026-09-24.json");
const OUTPUT_MD = path.join(WORKSPACE_ROOT, "outputs", "游研所游戏扫描POC_2026-09-24.md");

const platforms = [
  { key: "wx_minigame", label: "微信小游戏" },
  { key: "dy_minigame", label: "抖音小游戏" },
  { key: "ios_cn", label: "iOS 中国" },
  { key: "gp_us", label: "Google Play 美国" },
  { key: "buy_material", label: "买量榜" },
];

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function urlForRank(platform, extra = "") {
  return `${SITE}/kb/rank?platform=${encodeURIComponent(platform)}&rank_type=popularity&period=day&date=${RUN_DATE}${extra}`;
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "casual-radar-youyansuo-poc/0.1" },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function parseRankRows(html, platform, label) {
  const rows = [];
  const rowPattern = /<a href="\/kb\/rank\/app\/([^?]+)[^"]*" class="kb-rankg-row[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(rowPattern)) {
    const appId = match[1];
    const body = match[2];
    const rank = Number(cleanText(body.match(/<strong[^>]*>([\d,]+)<\/strong>/)?.[1] || "")) || null;
    const title = cleanText(body.match(/<span class="kb-rankg-title">([\s\S]*?)<\/span>/)?.[1] || "");
    const genre = cleanText(body.match(/<span class="kb-rankg-chip rank-genre"[^>]*data-genre="([^"]*)"[^>]*>/)?.[1] || "");
    const theme = cleanText(body.match(/<span class="kb-rankg-chip is-muted">([\s\S]*?)<\/span>/)?.[1] || "");
    const publisher = cleanText(body.match(/<span class="rank-pub[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "");
    const changeText = cleanText(body.match(/<span class="kb-rankg-change">([\s\S]*?)<\/span>/)?.[1] || "");
    const change = /^▲(\d+)$/.test(changeText) ? Number(changeText.slice(1)) : /^▼-?(\d+)$/.test(changeText) ? -Number(changeText.replace(/[^\d]/g, "")) : 0;
    const href = `${SITE}/kb/rank/app/${appId}?platform=${encodeURIComponent(platform)}`;
    if (title && rank) rows.push({ app_id: appId, title, rank, genre, theme, publisher, change, change_text: changeText, platform, platform_label: label, url: href });
  }
  const meta = cleanText(html.match(/<p class="kb-rankg-meta">([\s\S]*?)<\/p>/)?.[1] || "");
  const stats = {};
  for (const [key, pattern] of [["new", /新进\s*(\d+)/], ["up", /上升\s*(\d+)/], ["down", /下降\s*(\d+)/], ["flat", /持平\s*(\d+)/]]) stats[key] = Number(cleanText(html.match(pattern)?.[1] || "0"));
  return { platform, platform_label: label, source_url: urlForRank(platform), meta, stats, rows };
}

function parsePayloads(html) {
  const records = [];
  const pattern = /data-card-payload='([^']*)'/g;
  for (const match of html.matchAll(pattern)) {
    try {
      const payload = JSON.parse(match[1]);
      if (payload?.id && payload?.title) records.push({
        id: String(payload.id),
        title: payload.title,
        author: payload.author || "",
        published: payload.published || "",
        read_num: Number(payload.read_num || 0) || 0,
        summary: payload.summary || "",
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        article_url: decodeHtml(payload.href || ""),
        item_url: `${SITE}${payload.item_page || `/kb/item/${payload.id}`}`,
      });
    } catch {
      // A malformed card should not invalidate the rest of the scan.
    }
  }
  return records;
}

function canonicalIndex(games) {
  const index = new Map();
  for (const game of games) {
    const names = [game.name, ...(Array.isArray(game.aliases) ? game.aliases : []), game.name_en].filter(Boolean);
    for (const name of names) index.set(String(name).toLocaleLowerCase(), game.name);
  }
  return index;
}

function matchTracked(title, index) {
  const exact = index.get(String(title).toLocaleLowerCase());
  if (exact) return exact;
  const lower = String(title).toLocaleLowerCase();
  for (const [key, canonical] of index) if (key.length >= 3 && (lower.includes(key) || key.includes(lower))) return canonical;
  return null;
}

function scoreCandidate(row, articleCount = 0) {
  let score = 0;
  if (row.new_kind === "first") score += 45;
  if (row.new_kind === "again") score += 25;
  if (row.change > 0) score += Math.min(row.change * 3, 24);
  if (row.rank && row.rank <= 30) score += 18;
  if (articleCount) score += Math.min(articleCount * 4, 12);
  return score;
}

function renderMarkdown(result) {
  const lines = [
    `# 游研所游戏扫描 POC（${RUN_DATE}）`,
    "",
    "本次用游研所公开页面回放 MCP 的核心扫描逻辑；MCP 接口当前仍需要 OAuth 授权，因此结果标记为 public-replay，不代表已完成 MCP 授权。",
    "",
    `- 扫描平台：${result.rank_scan.platforms.map((x) => x.platform_label).join("、")}`,
    `- 榜单总行数：${result.rank_scan.total_rows}`,
    `- 今日新进候选：${result.discovery.new_candidates.length}`,
    `- 已追踪产品榜单异动：${result.discovery.tracked_alerts.length}`,
    `- 文章检索样本：${result.article_scan.queries.length} 款，命中 ${result.article_scan.total_records} 条`,
    "",
    "## 这对游戏扫描的直接作用",
    "",
    "1. 以多平台榜单发现新产品：将首次新进、再次新进、快速上升和买量榜出现作为候选信号。",
    "2. 以文章库补齐候选解释：搜索产品名后保留作者、发布时间、摘要、阅读量和原文链接。",
    "3. 以历史排名确认趋势：对候选调用 `get_game_rank_history`，区分一次性波动和持续上升。",
    "4. 以产品与厂商资料完成核验：对候选调用 `search_games` / `get_game` / `get_publisher_games`，补齐开发商、平台、品类和同厂商产品。",
    "",
    "## 高优先级候选",
    "",
    "| 产品 | 平台 | 排名 | 新进/异动 | 品类 | 开发商 | 文章数 | 扫描分 |",
    "|---|---|---:|---|---|---|---:|---:|",
    ...result.discovery.new_candidates.slice(0, 20).map((x) => `| ${x.title} | ${x.platform_label} | ${x.rank} | ${x.new_kind || x.change_text || "—"} | ${x.genre || "—"} | ${x.publisher || "—"} | ${x.article_count} | ${x.score} |`),
    "",
    "## 已追踪产品异动",
    "",
    "| 产品 | 平台 | 排名 | 变化 | 品类 | 开发商 |",
    "|---|---|---:|---:|---|---|",
    ...result.discovery.tracked_alerts.slice(0, 20).map((x) => `| ${x.title} | ${x.platform_label} | ${x.rank} | ${x.change_text || "—"} | ${x.genre || "—"} | ${x.publisher || "—"} |`),
    "",
    "## 接入现有看板的建议",
    "",
    "- 每日扫描：`get_rank` 拉 5 个平台的当日榜单，只写入候选和异动，不自动进入主追踪池。",
    "- 候选复核：`search_games` → `get_game` → `get_game_rank_history` → `list_game_articles`，生成产品身份、排名趋势和内容证据。",
    "- 周更入池：只有产品身份、平台、品类和至少一条可追溯来源齐全时，才进入现有 `games[]` / `weekly_scan.json` 的人工复核队列。",
    "- 页面呈现：在“在研新品”增加“榜单新进/上升”标签，在“情报雷达”增加“多平台出现”和“文章支持度”。",
    "",
    "## 本次限制",
    "",
    "当前 MCP endpoint 返回 401，并通过 OAuth protected resource metadata 声明需要授权；本次只用公开 HTML 回放同一类数据，不把公开页面当作 MCP 已授权调用。",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const gamesBundle = JSON.parse(await fs.readFile(path.join(ROOT, "public", "games.json"), "utf8"));
  const games = Array.isArray(gamesBundle.games) ? gamesBundle.games : [];
  const index = canonicalIndex(games);
  const rankPages = [];
  for (const platform of platforms) rankPages.push(parseRankRows(await fetchText(urlForRank(platform.key)), platform.key, platform.label));
  const newPages = [];
  for (const item of [
    { platform: "wx_minigame", label: "微信小游戏", kind: "first" },
    { platform: "wx_minigame", label: "微信小游戏", kind: "again" },
  ]) newPages.push({ ...parseRankRows(await fetchText(urlForRank(item.platform, `&new_kind=${item.kind}`)), item.platform, item.label), new_kind: item.kind });
  const newRows = newPages.flatMap((page) => page.rows.map((row) => ({ ...row, new_kind: page.new_kind })));
  const rankRows = rankPages.flatMap((page) => page.rows);
  const articleQueries = [...new Set([
    ...newRows.slice(0, 8).map((row) => row.title),
    "蛋仔派对",
    "元梦之星",
    "开心消消乐",
  ])].slice(0, 12);
  const articleResults = [];
  for (const query of articleQueries) {
    const url = `${SITE}/kb/items?q=${encodeURIComponent(query)}&days=90&order=recent`;
    const records = parsePayloads(await fetchText(url));
    articleResults.push({ query, source_url: url, records });
  }
  const articleCountByQuery = new Map(articleResults.map((item) => [item.query, item.records.length]));
  const discovery = newRows
    .map((row) => ({ ...row, tracked_name: matchTracked(row.title, index), article_count: articleCountByQuery.get(row.title) || 0 }))
    .filter((row) => !row.tracked_name)
    .map((row) => ({ ...row, score: scoreCandidate(row, row.article_count) }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank);
  const trackedAlerts = rankRows
    .map((row) => ({ ...row, tracked_name: matchTracked(row.title, index) }))
    .filter((row) => row.tracked_name && (row.change >= 3 || row.new_kind))
    .sort((a, b) => b.change - a.change || a.rank - b.rank);
  const seenAcrossPlatforms = new Map();
  for (const row of rankRows) {
    const key = matchTracked(row.title, index) || row.title;
    const item = seenAcrossPlatforms.get(key) || { title: key, platforms: [], best_rank: null };
    if (!item.platforms.some((platform) => platform.platform === row.platform)) item.platforms.push({ platform: row.platform, platform_label: row.platform_label, rank: row.rank, change: row.change });
    item.best_rank = item.best_rank == null ? row.rank : Math.min(item.best_rank, row.rank);
    seenAcrossPlatforms.set(key, item);
  }
  const crossPlatform = [...seenAcrossPlatforms.values()].filter((item) => item.platforms.length >= 2).sort((a, b) => b.platforms.length - a.platforms.length || a.best_rank - b.best_rank).slice(0, 30);
  const result = {
    meta: { generated_at: new Date().toISOString(), run_date: RUN_DATE, mode: "public-replay", mcp_endpoint: `${SITE}/kb/mcp/mcp`, authorization: "required", tracked_games_source: "dashboard-site/public/games.json", tracked_games: games.length },
    rank_scan: { platforms: rankPages.map(({ platform, platform_label, source_url, meta, stats }) => ({ platform, platform_label, source_url, meta, stats })), total_rows: rankRows.length },
    discovery: { new_candidates: discovery, tracked_alerts: trackedAlerts, cross_platform: crossPlatform },
    article_scan: { queries: articleResults, total_records: articleResults.reduce((sum, item) => sum + item.records.length, 0) },
    mcp_mapping: {
      rank_scan: "get_rank",
      candidate_identity: ["search_games", "get_game"],
      history: "get_game_rank_history",
      articles: ["search_articles", "list_game_articles", "get_article"],
      publisher_context: ["get_publisher_games", "search_companies", "get_company"],
      follow_up: "get_hotspot_tracking",
    },
  };
  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(result, null, 2)}\n`);
  await fs.writeFile(OUTPUT_MD, renderMarkdown(result));
  console.log(JSON.stringify({ output_json: OUTPUT_JSON, output_markdown: OUTPUT_MD, tracked_games: games.length, rank_rows: rankRows.length, new_candidates: discovery.length, tracked_alerts: trackedAlerts.length, article_queries: articleQueries.length, article_records: result.article_scan.total_records }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
