import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildGameEntityIndex, canonicalGameName, isLowConfidenceEventSource, isUnrelatedProductEvidence, loadTrackedGames, matchesEntityEvidence } from "./weekly-refresh-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(siteRoot, "public");
const outputPath = path.join(publicRoot, "databrain_events.json");
const researchOutputPath = path.join(publicRoot, "databrain_research.json");
const endpoint = "https://databrain.intlgame.com/api/agent/chat";

function readJson(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(publicRoot, filename), "utf8"));
  } catch {
    return fallback;
  }
}

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function dateKey(value) {
  const match = text(value).match(/(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${(match[3] || "01").padStart(2, "0")}` : "";
}

function cleanCell(value) {
  return text(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
}

function cellUrl(value) {
  const raw = text(value);
  return raw.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)?.[1] || raw.match(/https?:\/\/[^\s)]+/)?.[0] || "";
}

function splitTableRow(line) {
  const cells = [];
  let current = "";
  let escaped = false;
  for (const character of text(line)) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (escaped) current += "\\";
  cells.push(current.trim());
  if (cells[0] === "") cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function parseMarkdownTables(markdown) {
  const rows = [];
  const lines = text(markdown).split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|") || !isTableSeparator(lines[index + 1])) continue;
    const headers = splitTableRow(lines[index]).map((header) => header.toLowerCase().replace(/[`\s-]+/g, "_") );
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex].trim();
      if (!line || !line.includes("|")) break;
      const cells = splitTableRow(line);
      if (cells.length < 2) continue;
      const row = {};
      headers.forEach((header, cellIndex) => {
        if (header) row[header] = cells[cellIndex] || "";
      });
      rows.push(row);
    }
    index += 1;
  }
  return rows;
}

function collectStructuredRows(value, rows = [], depth = 0) {
  if (depth > 7 || value === null || value === undefined) return rows;
  if (typeof value === "string") {
    const candidate = value.trim();
    if (!candidate || (!candidate.startsWith("[") && !candidate.startsWith("{"))) return rows;
    try {
      collectStructuredRows(JSON.parse(candidate), rows, depth + 1);
    } catch {
      // DataBrain sometimes wraps JSON in a fenced block; markdown parsing handles that path.
    }
    return rows;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredRows(item, rows, depth + 1));
    return rows;
  }
  if (typeof value !== "object") return rows;
  const object = value;
  const keys = Object.keys(object).map((key) => key.toLowerCase());
  const hasDate = keys.some((key) => ["event_date", "eventdate", "occurred_at", "published_date", "publisheddate", "published_at"].includes(key));
  if (hasDate && keys.some((key) => ["title", "headline", "name"].includes(key))) rows.push(object);
  for (const key of ["value", "data", "events", "annotations", "items", "rows", "results", "records"]) {
    if (key in object) collectStructuredRows(object[key], rows, depth + 1);
  }
  return rows;
}

function parseResponseRows(markdown, structured) {
  const rows = [...parseMarkdownTables(markdown)];
  for (const value of structured) collectStructuredRows(value, rows);
  for (const match of text(markdown).matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    try {
      collectStructuredRows(JSON.parse(match[1]), rows);
    } catch {
      // Keep parsing the markdown table even if an explanatory fenced block is malformed.
    }
  }
  return rows;
}

function parseArgs(argv) {
  const options = { games: [], start: "", end: "", batchSize: 10, maxPerGame: 8, concurrency: 3, cleanOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [key, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (key === "--clean-only") {
      options.cleanOnly = true;
    } else if (key === "--games") {
      options.games = text(value).split(",").map((item) => item.trim()).filter(Boolean);
      if (inlineValue === undefined) index += 1;
    } else if (key === "--start") {
      options.start = dateKey(value);
      if (inlineValue === undefined) index += 1;
    } else if (key === "--end") {
      options.end = dateKey(value);
      if (inlineValue === undefined) index += 1;
    } else if (key === "--batch-size") {
      options.batchSize = Math.max(1, Number(value) || 10);
      if (inlineValue === undefined) index += 1;
    } else if (key === "--max-per-game") {
      options.maxPerGame = Math.max(1, Number(value) || 8);
      if (inlineValue === undefined) index += 1;
    } else if (key === "--concurrency") {
      options.concurrency = Math.min(3, Math.max(1, Number(value) || 3));
      if (inlineValue === undefined) index += 1;
    }
  }
  return options;
}

export async function collectBatchResults(batches, query, concurrency = 3) {
  const results = new Array(batches.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (next < batches.length) {
      const index = next++;
      try { results[index] = { result: await query(batches[index], index) }; }
      catch (error) { results[index] = { error }; }
    }
  }));
  return results;
}

function eventDateMeaning(value) {
  return /事件|发生|上线|开始|发售|更新日期|赛季.*日期|促销.*日期/i.test(text(value));
}

function publicationDateMeaning(value) {
  return /发布|报道|消息|文章|报告|收录日期/i.test(text(value));
}

function hasConflictingTitleEntity(gameName, title, entityIndex) {
  const normalizedTitle = text(title).normalize("NFKC").toLocaleLowerCase();
  for (const entity of entityIndex?.entities || []) {
    if (entity.canonical === gameName) continue;
    const names = [entity.canonical, ...entity.queryNames]
      .map((name) => text(name).normalize("NFKC").toLocaleLowerCase())
      .filter((name) => name.length >= 3);
    if (names.some((name) => normalizedTitle.includes(name))) return true;
  }
  return false;
}

function normalizeRow(row, entityIndex, aliasesByCanonical, requested, start, end) {
  const gameName = canonicalGameName(row.game_name || row.gameName || row.game || row.product || row.name, entityIndex);
  if (!requested.has(gameName)) return null;
  const rawMeaning = text(row.date_meaning || row.dateMeaning);
  const eventDate = dateKey(row.event_date || row.eventDate || row.occurred_at || row.start_date || row.startDate || (eventDateMeaning(rawMeaning) ? row.date : ""));
  if (!eventDate || eventDate < start || eventDate > end) return null;
  const publishedDate = dateKey(row.published_date || row.publishedDate || row.publishedAt || row.published_at || row.message_date);
  const title = cleanCell(row.title || row.label || row.headline || row.version || row.event || "近期产品事件");
  const summary = cleanCell(row.summary || row.description || row.message || row.text || title);
  const source = cleanCell(row.source || row.source_name || row.platform || "公开信源");
  const url = cellUrl(row.url || row.source_url || row.link);
  if (!title || !summary) return null;
  if (isUnrelatedProductEvidence(gameName, title, summary)) return null;
  if (hasConflictingTitleEntity(gameName, title, entityIndex)) return null;
  if (!matchesEntityEvidence(aliasesByCanonical.get(gameName) || [gameName], [title, summary, url])) return null;
  if (isLowConfidenceEventSource(source, url)) return null;
  return {
    game_name: gameName,
    event_date: eventDate,
    ...(publishedDate ? { published_date: publishedDate } : {}),
    title,
    summary,
    source,
    ...(url ? { url } : {}),
    date_meaning: rawMeaning || "事件日期",
  };
}

function normalizeResearchRow(row, entityIndex, aliasesByCanonical, requested, start, end) {
  const gameName = canonicalGameName(row.game_name || row.gameName || row.game || row.product || row.name, entityIndex);
  if (!requested.has(gameName)) return null;
  const rawMeaning = text(row.date_meaning || row.dateMeaning);
  const publishedDate = dateKey(row.published_date || row.publishedDate || row.publishedAt || row.published_at || row.message_date || (publicationDateMeaning(rawMeaning) ? row.date : ""));
  if (!publishedDate || publishedDate < start || publishedDate > end) return null;
  const eventDate = dateKey(row.event_date || row.eventDate || row.occurred_at || row.start_date || row.startDate || (eventDateMeaning(rawMeaning) ? row.date : ""));
  const title = cleanCell(row.title || row.label || row.headline || row.version || row.event || "近期产品资料");
  const summary = cleanCell(row.summary || row.description || row.message || row.text || title);
  const source = cleanCell(row.source || row.source_name || row.platform || "DataBrain 资料库");
  const url = cellUrl(row.url || row.source_url || row.link);
  const contentType = cleanCell(row.record_type || row.recordType || row.content_type || row.contentType || row.kind || "研究资料");
  if (!title || !summary) return null;
  if (isUnrelatedProductEvidence(gameName, title, summary)) return null;
  if (hasConflictingTitleEntity(gameName, title, entityIndex)) return null;
  if (!matchesEntityEvidence(aliasesByCanonical.get(gameName) || [gameName], [title, summary, url])) return null;
  if (isLowConfidenceEventSource(source, url)) return null;
  return {
    game_name: gameName,
    published_date: publishedDate,
    ...(eventDate ? { event_date: eventDate } : {}),
    title,
    summary,
    source,
    ...(url ? { url } : {}),
    content_type: contentType,
  };
}

function dedupeEvents(rows, maxPerGame, limitedGames = new Set()) {
  const byGame = new Map();
  const seen = new Set();
  for (const row of rows) {
    const gameName = row.game_name;
    const key = `${gameName}|${row.event_date}|${row.url || row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byGame.has(gameName)) byGame.set(gameName, []);
    byGame.get(gameName).push(row);
  }
  for (const items of byGame.values()) {
    items.sort((left, right) => right.event_date.localeCompare(left.event_date) || left.title.localeCompare(right.title, "zh-CN"));
    if (!limitedGames.size || limitedGames.has(items[0]?.game_name)) items.splice(maxPerGame);
  }
  return byGame;
}

export function queryText(games, aliasesByCanonical, start, end, maxPerGame) {
  const entities = games.map((canonical) => {
    const aliases = (aliasesByCanonical.get(canonical) || []).filter((name) => name.toLocaleLowerCase() !== canonical.toLocaleLowerCase());
    return aliases.length ? `${canonical}（别名：${aliases.join("、")}）` : canonical;
  });
  return `请只处理以下游戏实体，主名称和括号内别名都必须逐一检索，但同一内容不要重复：${entities.join("；")}。扫描 DataBrain 内部游戏库、GRP 报告库、游戏研究所Pro、微信公众号资料库与官方渠道，查询 ${start} 至 ${end} 发布的产品相关内容。覆盖两类记录：1）record_type=event：版本更新、赛季切换、活动、联动、测试、定档、上线、发售或促销，event_date 必须是实际发生日期；2）record_type=research：产品分析、测试报告、研发团队、市场表现、预约、口碑与玩法研究，可没有 event_date，但必须有 published_date。每个游戏最多 ${maxPerGame} 条，优先返回公众号库、游戏研究所Pro、GRP 与官方新内容。只输出一张 Markdown 表格，不要解释。表头固定为 game_name | record_type | event_date | published_date | title | summary | source | url | date_meaning。game_name 保留命中资料使用的原始名称；title、summary 或 url 中必须明确出现主名称或至少一个别名，summary 中应补全产品名称；published_date 必须是消息、文章或报告发布日期。无法确认产品身份或发布日期的内容不要输出。不要引用 APK 下载站、账号交易平台、攻略站或无法追溯原始内容的聚合页。不要输出纯 DAU 数字或泛行业新闻。`;
}

async function queryDataBrainOnce(query) {
  const token = text(process.env.DATABRAIN_TOKEN);
  if (!token) throw new Error("DATABRAIN_TOKEN 未设置，无法刷新 DataBrain 事件。");
  const sessionId = `dashboard_events_${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = {
    method: "tasks/sendSubscribe",
    params: {
      id: sessionId,
      sessionId,
      message: { role: "user", parts: [{ type: "text", text: query }] },
      metadata: { mode: "auto", source: "skill", platform: "codex", disable_memory: true, date_time: new Date().toISOString() },
    },
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/event-stream", Authorization: `Bearer ${token}`, "User-Agent": "databrain-agent-skill" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error(`DataBrain HTTP ${response.status}`);
  const textParts = [];
  const structuredParts = [];
  const rawEvents = [];
  const decoder = new TextDecoder();
  const reader = response.body?.getReader();
  if (!reader) throw new Error("DataBrain 未返回流式响应。");
  let buffer = "";
  const consumeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return;
    try {
      const message = JSON.parse(trimmed.slice(6));
      rawEvents.push(message);
      if (message.error) throw new Error(message.error.message || "DataBrain 返回错误");
      for (const part of message.result?.artifact?.parts || []) {
        if (part.type === "text") textParts.push(text(part.text));
        if (part.type === "data") structuredParts.push(part.data?.value ?? part.data);
      }
    } catch (error) {
      if (error instanceof SyntaxError) return;
      throw error;
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      consumeLine(line);
    }
  }
  if (buffer.trim()) consumeLine(buffer);
  const markdown = textParts.join("");
  const auditRoot = path.join(siteRoot, ".automation", "databrain-events");
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(path.join(auditRoot, `${sessionId}.json`), `${JSON.stringify({ sessionId, query, events: rawEvents }, null, 2)}\n`);
  if (/无法处理.*未来|cannot[^\n]*future/i.test(markdown)) throw new Error(`DataBrain refused date range: ${markdown.trim()}`);
  return { sessionId, markdown, structured: structuredParts };
}

async function queryDataBrain(query, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await queryDataBrainOnce(query);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (/DataBrain HTTP 4\d\d|DataBrain refused date range/.test(message) || attempt === maxAttempts) throw error;
      const waitMs = attempt * 5000;
      process.stdout.write(`  transient DataBrain error; retry ${attempt + 1}/${maxAttempts} in ${waitMs / 1000}s (${message})\n`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

function writeBundle(games, rows, meta) {
  const grouped = dedupeEvents(rows, meta.max_events_per_game, new Set(meta.queried_game_names || []));
  const gameBundle = {};
  for (const game of games) {
    const events = (grouped.get(game) || []).map((event) => Object.fromEntries(Object.entries(event).filter(([key]) => key !== "game_name")));
    if (events.length) gameBundle[game] = events;
  }
  const gamesWithEvents = Object.keys(gameBundle).length;
  const bundle = {
    meta: {
      ...meta,
      updated: new Date().toISOString(),
      games_with_events: gamesWithEvents,
      games_in_bundle: games.length,
      events: Object.values(gameBundle).reduce((total, events) => total + events.length, 0),
      source: "DataBrain Agent · Web Search",
      coverage_note: "事件由 DataBrain Agent 查询并要求给出实际发生日期；无明确实际日期的内容不会进入图表。DataBrain 当前返回的是可追溯公开信源事件，不是 DAU 原始序列。",
    },
    games: gameBundle,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

function writeResearchBundle(games, rows, meta) {
  const byGame = new Map();
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.game_name}|${row.published_date}|${row.url || row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byGame.has(row.game_name)) byGame.set(row.game_name, []);
    byGame.get(row.game_name).push(row);
  }
  const gameBundle = {};
  for (const game of games) {
    const records = (byGame.get(game) || [])
      .sort((left, right) => right.published_date.localeCompare(left.published_date) || left.title.localeCompare(right.title, "zh-CN"))
      .slice(0, meta.max_records_per_game)
      .map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== "game_name")));
    if (records.length) gameBundle[game] = records;
  }
  const sourceCounts = {};
  for (const records of Object.values(gameBundle)) for (const record of records) sourceCounts[record.source] = (sourceCounts[record.source] || 0) + 1;
  const bundle = {
    meta: {
      ...meta,
      updated: new Date().toISOString(),
      games_with_research: Object.keys(gameBundle).length,
      games_in_bundle: games.length,
      records: Object.values(gameBundle).reduce((total, records) => total + records.length, 0),
      source_counts: sourceCounts,
      coverage_note: "统一扫描全部跟踪产品及别名；研究资料按发布日期收录，不自动作为测试、上线或版本事件。",
    },
    games: gameBundle,
  };
  fs.writeFileSync(researchOutputPath, `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const trends = readJson("databrain_trends_90d.json", { meta: {}, games: {} });
  const gamesData = readJson("games.json", { games: [] });
  const trackedGames = loadTrackedGames(path.join(publicRoot, "games.json"));
  const aliasesByCanonical = new Map(trackedGames.map((game) => [game.canonical, game.queryNames]));
  const available = new Set(trackedGames.map((game) => game.canonical));
  const entityIndex = buildGameEntityIndex(gamesData.games || []);
  const requested = options.games.length ? options.games.map((name) => canonicalGameName(name, entityIndex)).filter((name) => available.has(name)) : trackedGames.map((game) => game.canonical);
  if (!requested.length) throw new Error("没有找到可查询的游戏；请检查 --games 名称。");
  const range = Array.isArray(trends.meta?.query_range) ? trends.meta.query_range : [];
  const start = options.start || dateKey(range[0]) || "2026-05-25";
  const end = options.end || dateKey(range.at(-1)) || "2026-09-09";
  const existing = readJson("databrain_events.json", { games: {} });
  const existingResearch = readJson("databrain_research.json", { games: {} });
  const existingRows = [];
  for (const [gameName, events] of Object.entries(existing.games || {})) {
    const canonical = canonicalGameName(gameName, entityIndex);
    for (const event of Array.isArray(events) ? events : []) {
      if (!isLowConfidenceEventSource(event.source, event.url) && !isUnrelatedProductEvidence(canonical, event.title, event.summary) && !hasConflictingTitleEntity(canonical, event.title, entityIndex)) existingRows.push({ game_name: canonical, ...event });
    }
  }
  const existingResearchRows = [];
  for (const [gameName, records] of Object.entries(existingResearch.games || {})) {
    const canonical = canonicalGameName(gameName, entityIndex);
    for (const record of Array.isArray(records) ? records : []) {
      if (!isLowConfidenceEventSource(record.source, record.url) && !isUnrelatedProductEvidence(canonical, record.title, record.summary) && !hasConflictingTitleEntity(canonical, record.title, entityIndex)) existingResearchRows.push({ game_name: canonical, ...record });
    }
  }
  const bundleGames = [...new Set([...Object.keys(existing.games || {}), ...Object.keys(existingResearch.games || {}), ...requested])];
  if (options.cleanOnly) {
    const eventMeta = { ...existing.meta, query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_events_per_game: options.maxPerGame };
    const researchMeta = { ...existingResearch.meta, query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_records_per_game: options.maxPerGame };
    const final = writeBundle(bundleGames, existingRows, eventMeta);
    const research = writeResearchBundle(bundleGames, existingResearchRows, researchMeta);
    process.stdout.write(`${JSON.stringify({ clean_only: true, games_queried: requested.length, games_with_events: final.meta.games_with_events, events: final.meta.events, games_with_research: research.meta.games_with_research, research_records: research.meta.records })}\n`);
    return;
  }
  const sessions = [];
  const batches = [];
  for (let index = 0; index < requested.length; index += options.batchSize) batches.push(requested.slice(index, index + options.batchSize));
  let rows = existingRows;
  let researchRows = existingResearchRows;
  const completedBatches = [];
  const failedBatches = [];
  const responses = await collectBatchResults(batches, async (batch, index) => {
    process.stdout.write(`DataBrain query ${index + 1}/${batches.length}: ${batch.join("、")}\n`);
    const response = await queryDataBrain(queryText(batch, aliasesByCanonical, start, end, options.maxPerGame));
    process.stdout.write(`  query ${index + 1}/${batches.length} returned\n`);
    return response;
  }, options.concurrency);
  for (const [index, batch] of batches.entries()) {
    process.stdout.write(`DataBrain events ${index + 1}/${batches.length}: ${batch.join("、")}\n`);
    const query = queryText(batch, aliasesByCanonical, start, end, options.maxPerGame);
    let result;
    try {
      if (responses[index].error) throw responses[index].error;
      result = responses[index].result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedBatches.push({ batch: index + 1, games: batch, error: message });
      process.stdout.write(`  request failed; keeping previous rows (${message})\n`);
      const meta = { query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_events_per_game: options.maxPerGame, max_records_per_game: options.maxPerGame, sessions, completed_batches: completedBatches, failed_batches: failedBatches, batch_size: options.batchSize };
      writeBundle(bundleGames, rows, meta);
      writeResearchBundle(bundleGames, researchRows, meta);
      continue;
    }
    if (process.env.DATABRAIN_DEBUG_EVENTS === "1") {
      process.stdout.write(`  response text=${result.markdown.length} structured=${result.structured.length}\n${result.markdown.slice(-2000)}\n`);
    }
    let parsed = parseResponseRows(result.markdown, result.structured);
    if (!parsed.length) {
      process.stdout.write("  no parseable rows; retrying with a stricter table-only prompt\n");
      try {
        result = await queryDataBrain(`${query}\n请再次检索并直接输出表格；每行必须同时包含 game_name、record_type、published_date、title、summary、source、url；事件记录另填 event_date。`);
        parsed = parseResponseRows(result.markdown, result.structured);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedBatches.push({ batch: index + 1, games: batch, error: message });
        process.stdout.write(`  retry failed; keeping previous rows (${message})\n`);
        const meta = { query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_events_per_game: options.maxPerGame, max_records_per_game: options.maxPerGame, sessions, completed_batches: completedBatches, failed_batches: failedBatches, batch_size: options.batchSize };
        writeBundle(bundleGames, rows, meta);
        writeResearchBundle(bundleGames, researchRows, meta);
        continue;
      }
    }
    if (!parsed.length) {
      failedBatches.push({ batch: index + 1, games: batch, error: "Two responses contained no parseable records; coverage is unconfirmed" });
      process.stdout.write("  no parseable records after retry; coverage failed, previous rows retained\n");
      continue;
    }
    sessions.push({ sessionId: result.sessionId, system_url: `https://databrain.woa.com/v2/agent/chat?sessionId=${result.sessionId}`, games: batch });
    const normalized = parsed.map((row) => normalizeRow(row, entityIndex, aliasesByCanonical, new Set(batch), start, end)).filter(Boolean);
    const normalizedResearch = parsed.map((row) => normalizeResearchRow(row, entityIndex, aliasesByCanonical, new Set(batch), start, end)).filter(Boolean);
    // A transient empty response must not erase the last successful snapshot for
    // a game. Replace a game's rows only after at least one valid row is parsed.
    const normalizedEventGames = new Set(normalized.map((row) => row.game_name));
    const normalizedResearchGames = new Set(normalizedResearch.map((row) => row.game_name));
    rows = normalized.length ? [...rows.filter((row) => !normalizedEventGames.has(row.game_name)), ...normalized] : rows;
    researchRows = normalizedResearch.length ? [...researchRows.filter((row) => !normalizedResearchGames.has(row.game_name)), ...normalizedResearch] : researchRows;
    completedBatches.push(index + 1);
    const meta = { query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_events_per_game: options.maxPerGame, max_records_per_game: options.maxPerGame, sessions, completed_batches: completedBatches, failed_batches: failedBatches, batch_size: options.batchSize };
    writeBundle(bundleGames, rows, meta);
    writeResearchBundle(bundleGames, researchRows, meta);
    process.stdout.write(`  parsed ${normalized.length} events and ${normalizedResearch.length} research records\n`);
  }
  const meta = { query_range: [start, end], games_queried: requested.length, queried_game_names: requested, max_events_per_game: options.maxPerGame, max_records_per_game: options.maxPerGame, sessions, completed_batches: completedBatches, failed_batches: failedBatches, batch_size: options.batchSize };
  const final = writeBundle(bundleGames, rows, meta);
  const research = writeResearchBundle(bundleGames, researchRows, meta);
  process.stdout.write(`${JSON.stringify({ output: outputPath, research_output: researchOutputPath, games_queried: requested.length, games_with_events: final.meta.games_with_events, events: final.meta.events, games_with_research: research.meta.games_with_research, research_records: research.meta.records, sessions: sessions.length, failed_batches: failedBatches.length })}\n`);
  if (failedBatches.length) throw new Error(`DataBrain events/research coverage failed for ${failedBatches.length}/${batches.length} batches; see failed_batches`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { normalizeResearchRow, normalizeRow, parseResponseRows };
