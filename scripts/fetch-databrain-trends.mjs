import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chunk, loadTrackedGames, resolveRange } from "./weekly-refresh-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gamesPath = path.join(siteRoot, "public", "games.json");
const endpoint = "https://databrain.intlgame.com/api/agent/chat";

function arg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function queryText(games, start, end) {
  const entities = games.map(({ canonical, queryNames }) => {
    const aliases = queryNames.filter((name) => name.toLocaleLowerCase() !== canonical.toLocaleLowerCase());
    return aliases.length ? `${canonical}（别名：${aliases.join("、")}）` : canonical;
  });
  return `只查询下列游戏实体，主名称和括号内别名都必须逐一检索，但同一实体不要重复统计，返回 ${start} 至 ${end} 的日频原始 bi_data：${entities.join("；")}。移动端需要 daily DAU 和 daily revenue；PC/Steam 需要 daily Alinea ACU、PCU 和 daily estimated revenue。每行必须保留数据源返回的原始 game_name、game_type、date、granularity、metric、platform、region_name/market_name、source 及指标值。不要插值，不要将 DAU 当作 ACU，不要用月收入或累计收入代替日收入。`;
}

async function fetchBatch(games, start, end) {
  const token = String(process.env.DATABRAIN_TOKEN || "").trim();
  if (!token) throw new Error("DATABRAIN_TOKEN 未设置，无法刷新 DataBrain 指标。");
  const sessionId = `dashboard_metrics_${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = {
    method: "tasks/sendSubscribe",
    params: {
      id: sessionId,
      sessionId,
      message: { role: "user", parts: [{ type: "text", text: queryText(games, start, end) }] },
      metadata: { mode: "auto", source: "skill", platform: "codex", disable_memory: true, date_time: new Date().toISOString() }
    }
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/event-stream", Authorization: `Bearer ${token}`, "User-Agent": "databrain-agent-skill" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300000)
  });
  if (!response.ok) throw new Error(`DataBrain HTTP ${response.status}`);
  const events = [];
  const reader = response.body?.getReader();
  if (!reader) throw new Error("DataBrain 未返回流式响应。");
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return;
    let item;
    try { item = JSON.parse(trimmed.slice(6)); } catch { return; }
    if (item.error) throw new Error(item.error.message || "DataBrain 返回错误");
    events.push(item);
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      consume(buffer.slice(0, newline).replace(/\r$/, ""));
      buffer = buffer.slice(newline + 1);
    }
  }
  if (buffer.trim()) consume(buffer);
  return { sessionId, system_url: `https://databrain.woa.com/v2/agent/chat?sessionId=${sessionId}`, events };
}

async function main() {
  const outputRoot = path.resolve(arg("--output-root", path.join(siteRoot, "..", "outputs")));
  const manifestPath = path.join(outputRoot, "databrain_latest_90d_manifest.json");
  const range = resolveRange(arg("--end", ""), Number(arg("--fetch-days", "104")));
  const windowDays = Math.max(1, Number(arg("--window-days", "90")) || 90);
  const start = arg("--start", range.start);
  const batchSize = Math.max(1, Number(arg("--batch-size", "18")) || 18);
  const requestedGames = arg("--games", "").split(",").map((name) => name.trim()).filter(Boolean);
  const requestedSet = new Set(requestedGames.map((name) => name.toLocaleLowerCase()));
  const allTracked = loadTrackedGames(gamesPath);
  const tracked = requestedSet.size
    ? allTracked.filter(({ canonical, queryNames }) => requestedSet.has(canonical.toLocaleLowerCase()) || queryNames.some((name) => requestedSet.has(name.toLocaleLowerCase())))
    : allTracked;
  if (requestedSet.size && !tracked.length) throw new Error(`没有找到可查询的游戏：${requestedGames.join("、")}`);
  const batches = chunk(tracked, batchSize);
  const plan = {
    created_at: new Date().toISOString(),
    query_range: [start, range.end],
    window_days: windowDays,
    tracked_games: tracked.length,
    batch_size: batchSize,
    batches: batches.map((records, index) => ({
      number: index + 1,
      file: `databrain_latest_90d_batch${index + 1}.json`,
      games: records.map(({ canonical, queryName, queryNames }) => ({ canonical, query_name: queryName, query_names: queryNames })),
      status: "planned",
    })),
  };
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  fs.mkdirSync(outputRoot, { recursive: true });
  let failed = false;
  for (const batch of plan.batches) {
    const output = path.join(outputRoot, batch.file);
    const queryEntities = batch.games.map((game) => ({ canonical: game.canonical, queryNames: game.query_names }));
    process.stdout.write(`DataBrain metrics ${batch.number}/${plan.batches.length}: ${batch.games.map((game) => game.canonical).join("、")}\n`);
    try {
      const result = await fetchBatch(queryEntities, start, range.end);
      fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
      const biParts = result.events.reduce((total, event) => total + (event.result?.artifact?.parts || []).filter((part) => part.type === "data" && part.data?.type === "bi_data").length, 0);
      batch.bi_data_parts = biParts;
      batch.session_id = result.sessionId;
      if (!biParts) throw new Error("DataBrain returned no bi_data; metric coverage is unconfirmed");
      batch.status = "complete";
      batch.bi_data_parts = biParts;
      batch.session_id = result.sessionId;
      process.stdout.write(`  saved ${biParts} bi_data parts (${result.events.length} stream events)\n`);
    } catch (error) {
      failed = true;
      batch.status = "failed";
      batch.error = error instanceof Error ? error.message : String(error);
      process.stdout.write(`  failed; public snapshot was not changed (${batch.error})\n`);
    }
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(plan, null, 2)}\n`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
