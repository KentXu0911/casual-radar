import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGameEntityIndex, normalizeEntityName } from "./weekly-refresh-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(siteRoot, "public");
const decisions = JSON.parse(fs.readFileSync(path.join(publicRoot, "editorial-decisions.json"), "utf8"));
const OUT_OF_SCOPE_REASONS = new Map(decisions.decisions.filter(decision => decision.action === "exclude")
  .map(decision => [decision.normalized_name || normalizeEntityName(decision.name), decision.reason]));

export function discoveryExclusionReason(name) {
  return OUT_OF_SCOPE_REASONS.get(normalizeEntityName(String(name || ""))) || "";
}
const EXCLUDED_CANDIDATES = new Set(decisions.decisions.filter(decision => decision.action === "exclude_candidate").map(decision => decision.normalized_name || normalizeEntityName(decision.name)));
const APPROVED_CANDIDATES = new Set(decisions.decisions.filter(decision => decision.action === "include_candidate").map(decision => decision.normalized_name || normalizeEntityName(decision.name)));

function arg(name) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function dateKey(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw ? "" : raw;
}

function todayShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function strings(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).map((item) => String(item || "").trim()).filter(Boolean);
}

function validSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}

export function normalizeDiscovery(input, gamesDocument, options = {}) {
  if (input?.source !== "youyansuo" || input.mode !== "mcp_read_only") throw new Error("输入必须是游研所 MCP 只读扫描结果。");
  if (input.status !== "complete") throw new Error(`游研所扫描未完整成功：${input.status || "unknown"}`);
  if (input.errors?.length || input.tool_calls?.failed > 0) throw new Error("游研所扫描包含失败调用，不能作为完整结果。");
  for (const query of input.coverage_notes?.queries || []) {
    if (query.status !== "success" || (query.expected_pages && query.fetched_pages !== query.expected_pages)) throw new Error("游研所查询或分页未完整成功。");
  }
  const scanDate = dateKey(input.scan_date);
  if (!scanDate || (!options.allowHistorical && scanDate !== (options.today || todayShanghai()))) {
    throw new Error(`游研所扫描日期不是今天：${scanDate || "missing"}`);
  }
  if (!input.tool_calls || typeof input.tool_calls !== "object" || !Number.isInteger(input.tool_calls.total) || input.tool_calls.total < 1) {
    throw new Error("缺少本次 MCP 工具调用记录，不能确认扫描覆盖。");
  }
  if (!Array.isArray(input.candidates) || !Array.isArray(input.tracked_updates)) {
    throw new Error("游研所扫描缺少候选或已跟踪动态数组。");
  }
  const entityIndex = buildGameEntityIndex(gamesDocument.games || []);
  const aliases = new Map();
  for (const entity of entityIndex.entities) {
    for (const name of [entity.canonical, ...entity.queryNames]) {
      const key = normalizeEntityName(name);
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key).add(entity.canonical);
    }
  }
  const seen = new Set();
  const normalize = (row, kind) => {
    const rawName = String(row.name || "").trim();
    if (discoveryExclusionReason(rawName) || row.scope_status === "out_of_scope" || (kind === "candidate" && EXCLUDED_CANDIDATES.has(normalizeEntityName(rawName)))) return null;
    const matches = aliases.get(normalizeEntityName(rawName)) || new Set();
    const name = matches.size === 1 ? [...matches][0] : rawName;
    if (discoveryExclusionReason(name)) return null;
    const publishedDate = dateKey(row.published_date);
    const sourceUrl = validSourceUrl(row.source_url);
    if (!name || !publishedDate || !sourceUrl || publishedDate > scanDate || row.scope_status === "out_of_scope") return null;
    const tracked = matches.size === 1;
    const disposition = matches.size > 1 ? "身份冲突" : kind === "candidate" && tracked ? "已晋级" : kind === "tracked" && tracked ? "已跟踪" : "待人工核验";
    const key = `${kind}|${name}|${sourceUrl}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      name,
      published_date: publishedDate,
      event_date: dateKey(row.event_date) || null,
      evidence_title: String(row.evidence_title || "").trim(),
      source_url: sourceUrl,
      summary: String(row.summary || "").trim(),
      identity_status: matches.size > 1 ? "ambiguous_alias" : kind === "candidate" ? String(row.identity_status || (tracked ? "matched_tracked" : "unverified")) : tracked ? "matched_tracked" : String(row.identity_status || "unverified"),
      scope_status: row.scope_status === "in_scope" ? "in_scope" : "uncertain",
      scope_reason: String(row.scope_reason || "").trim(),
      category: strings(row.category),
      platform: strings(row.platform),
      developer: String(row.developer || "").trim(),
      publisher: String(row.publisher || "").trim(),
      disposition,
      metrics_status: "未接入 DataBrain",
    };
  };
  const normalizedCandidates = input.candidates.map((row) => normalize(row, "candidate")).filter(Boolean);
  const trackedUpdates = input.tracked_updates.map((row) => normalize(row, "tracked")).filter(Boolean);
  const approved = row => APPROVED_CANDIDATES.has(normalizeEntityName(row.name));
  const candidates = options.publishApprovedOnly
    ? [...normalizedCandidates.filter(approved), ...input.tracked_updates.filter(approved).map(row => normalize(row, "candidate")).filter(Boolean)]
    : normalizedCandidates;
  const excludedRows = new Map();
  for (const decision of decisions.decisions.filter(row => ["exclude", "exclude_candidate"].includes(row.action))) {
    excludedRows.set(normalizeEntityName(decision.name), {
      name: decision.name, scope_status: decision.action === "exclude" ? "out_of_scope" : "candidate_duplicate",
      scope_reason: decision.reason, action: decision.action, source: decision.source,
      reviewed_at: decision.reviewed_at, evidence_url: decision.evidence_url || null,
      ...(decision.scope === "candidate_selection" ? { decision_source: "用户候选筛选" } : {}),
    });
  }
  for (const row of [...input.candidates, ...input.tracked_updates]) {
    if (row.scope_status === "out_of_scope" && !excludedRows.has(normalizeEntityName(row.name))) {
      excludedRows.set(normalizeEntityName(row.name), { name: String(row.name || "").trim(), scope_status: "out_of_scope", scope_reason: String(row.scope_reason || "重点品类外产品，不进入游研所情报区。") });
    }
  }
  candidates.sort((a, b) => b.published_date.localeCompare(a.published_date));
  trackedUpdates.sort((a, b) => b.published_date.localeCompare(a.published_date));
  return {
    meta: {
      source: "youyansuo",
      mode: "mcp_read_only",
      scan_date: scanDate,
      generated_at: new Date().toISOString(),
      status: "imported",
      candidates: candidates.length,
      tracked_updates: trackedUpdates.length,
      rejected_rows: input.candidates.length + input.tracked_updates.length - normalizedCandidates.length - trackedUpdates.length,
      pending_candidates: options.publishApprovedOnly ? normalizedCandidates.filter(row => !approved(row)).length : 0,
      candidate_publication_policy: options.publishApprovedOnly ? "editorial_approval_required" : "draft",
      tool_calls: input.tool_calls,
      coverage_notes: input.coverage_notes || [],
      excluded_rows: [...excludedRows.values()],
      coverage_note: "游研所提供产品情报；报道日期不等于事件发生日期，缺失指标不由 MCP 填充。",
    },
    candidates,
    tracked_updates: trackedUpdates,
  };
}

function main() {
  const inputName = arg("--input");
  if (!inputName) throw new Error("必须显式提供 --input=<本次 MCP 扫描 JSON>。");
  const inputPath = path.resolve(inputName);
  const outputPath = path.resolve(arg("--output") || path.join(publicRoot, "youyansuo_discovery.json"));
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const games = JSON.parse(fs.readFileSync(path.join(publicRoot, "games.json"), "utf8"));
  const bundle = normalizeDiscovery(input, games, { allowHistorical: process.argv.includes("--allow-historical"), publishApprovedOnly: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(bundle, null, 2)}\n`);
  fs.renameSync(temporary, outputPath);
  process.stdout.write(`${JSON.stringify({ output: outputPath, ...bundle.meta })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
