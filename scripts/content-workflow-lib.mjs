import { createHash } from "node:crypto";

export const digest = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const text = value => String(value || "").normalize("NFKC").trim();
const list = value => Array.isArray(value) ? value : [];
const validUrl = value => /^https?:\/\//.test(value || "");
const nameKey = value => text(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
export const day = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
};
export function milestoneKind(record) {
  const label = `${record.type || ""} ${record.title || ""}`;
  if (record.lifecycle_phase === "project" || /首曝|首次公开|首亮相/.test(label)) return "reveal";
  if (/版号|ISBN/.test(label)) return "license";
  if (/测试|首测|二测|三测|终测|体验服|Playtest|Beta|Demo/i.test(label)) return "test";
  return "other";
}
export function milestoneFingerprint(record) {
  return digest([record.date, record.end_date, record.type, record.title, record.status, record.lifecycle_phase, record.url].map(text));
}
export function mergeVerifiedDetail(existing = {}, incoming = {}) {
  const merge = (old = [], next = [], key) => {
    const records = new Map(next.map(item => [key(item), item]));
    // Existing curated fields win over generated snapshots. Explicit editorial
    // edits happen directly or through the review importer, never by re-import.
    for (const item of old) records.set(key(item), { ...records.get(key(item)), ...item });
    return [...records.values()];
  };
  return {
    ...incoming, ...existing,
    testing: { ...incoming.testing, ...existing.testing, records: merge(existing.testing?.records, incoming.testing?.records, item => `${item.date}|${item.type}|${item.title}`) },
    gameplay_videos: merge(existing.gameplay_videos, incoming.gameplay_videos, item => item.url),
    media_reports: merge(existing.media_reports, incoming.media_reports, item => `${item.date}|${item.url || item.title}`),
  };
}
export function synchronizeIdentities(dashboard, gamesDocument) {
  const products = new Map();
  const aliases = new Map(list(gamesDocument.games).filter(game => game.alias_of).map(game => [game.name, game.alias_of]));
  for (const game of [...list(gamesDocument.games), ...list(dashboard.games)]) {
    const name = game.alias_of || aliases.get(game.name) || game.name;
    if (!name) continue;
    const old = products.get(name);
    products.set(name, { ...old, ...game, name, product_id: old?.product_id || game.product_id || `product-${digest(name).slice(0, 16)}`, aliases: [...new Set([...(old?.aliases || []), ...(game.aliases || []), game.name].filter(x => x !== name))] });
  }
  for (const [name, detail] of Object.entries(dashboard.pipelineDetails || {})) {
    if (!products.has(name)) products.set(name, { name, product_id: detail.product_id || `product-${digest(name).slice(0, 16)}`, aliases: [] });
    const product = products.get(name);
    detail.product_id = product.product_id;
    for (const record of list(detail.testing?.records)) {
      record.product_id = product.product_id;
      record.milestone_id ||= `milestone-${digest([product.product_id, record.title, record.type, record.url]).slice(0, 20)}`;
      if (list(detail.testing?.records).some(other => other !== record && other.milestone_id === record.milestone_id)) {
        record.milestone_id = `milestone-${digest([product.product_id, record.title, record.type, record.url, record.date]).slice(0, 20)}`;
      }
      record.event_date = day(record.date) || null;
    }
    for (const video of list(detail.gameplay_videos)) {
      video.product_id = product.product_id;
      if (video.node_link_status === "unconfirmed") continue;
      const matches = list(detail.testing?.records).filter(record => record.date === video.milestone_date);
      if (matches.length === 1 && !video.milestone_id) video.milestone_id = matches[0].milestone_id;
    }
  }
  for (const document of [dashboard, gamesDocument]) {
    for (const game of list(document.games)) {
      if (aliases.has(game.name)) game.alias_of = aliases.get(game.name);
      game.product_id = products.get(game.alias_of || game.name).product_id;
    }
  }
  return { schema_version: 1, products: [...products.values()].map(product => ({
    product_id: product.product_id, name: product.name, aliases: product.aliases,
    category: product.category || dashboard.pipelineDetails?.[product.name]?.category || "",
    developer: product.developer || "", publisher: product.publisher || "",
    platforms: product.platforms || [],
    source_urls: list(product.profile?.source_url).map(source => source.url).filter(validUrl),
  })).sort((a, b) => a.product_id.localeCompare(b.product_id)) };
}
export function reviewIsComplete(review, record) {
  if (!review || review.fingerprint !== milestoneFingerprint(record) || !day(review.checked_at)) return false;
  if (review.status === "matched") return list(review.urls).length > 0 && review.urls.every(validUrl) && Boolean(review.scope);
  return review.status === "searched_no_match" && list(review.searches).length > 0 && review.searches.every(search => search.query && search.platform && search.status === "success") && Boolean(review.reason);
}
export function buildMediaQueue(dashboard, previous, archive = { reviews: {} }, { all = false } = {}) {
  const old = new Map(Object.values(previous?.pipelineDetails || {}).flatMap(detail => list(detail.testing?.records)).map(record => [record.milestone_id, record]));
  const tasks = [];
  for (const [name, detail] of Object.entries(dashboard.pipelineDetails || {})) {
    for (const record of list(detail.testing?.records)) {
      const kind = milestoneKind(record);
      if (!["reveal", "test"].includes(kind)) continue;
      const before = old.get(record.milestone_id);
      const changed = !before || milestoneFingerprint(before) !== milestoneFingerprint(record);
      const review = archive.reviews?.[record.milestone_id];
      if ((!changed && !all) || reviewIsComplete(review, record)) continue;
      tasks.push({ product_id: detail.product_id, product: name, milestone_id: record.milestone_id, fingerprint: milestoneFingerprint(record), event_date: record.date, title: record.title, kind, required_for_release: changed,
        status: review?.status || "not_run", queries: [...new Set([name, ...list(detail.aliases), ...list(dashboard.games).filter(game => game.product_id === detail.product_id).flatMap(game => [game.name, game.en, ...list(game.aliases)])].filter(Boolean))].map(alias => `${alias} ${kind === "reveal" ? "首曝 PV 实机演示" : record.title + " 实机 录播"}`), platforms: ["官方产品页", "Bilibili", "YouTube"] });
    }
  }
  return tasks;
}
export function applyMediaReviews(dashboard, archive, input, date) {
  for (const review of list(input?.reviews)) {
    const pair = Object.entries(dashboard.pipelineDetails).find(([, detail]) => list(detail.testing?.records).some(record => record.milestone_id === review.milestone_id));
    if (!pair) throw new Error(`Unknown milestone: ${review.milestone_id}`);
    const [name, detail] = pair;
    const record = detail.testing.records.find(item => item.milestone_id === review.milestone_id);
    if (review.fingerprint !== milestoneFingerprint(record)) throw new Error(`Stale media review: ${name}`);
    const normalized = { ...review, checked_at: review.checked_at || date };
    if (!["matched", "searched_no_match", "blocked"].includes(normalized.status)) throw new Error("Invalid search outcome");
    for (const video of list(normalized.videos)) {
      if (!validUrl(video.url) || !day(video.date) || !video.type || !video.source || video.evidence_kind !== "video") throw new Error(`Incomplete footage verification: ${name}`);
      if (video.milestone_date && video.milestone_date !== record.date || video.milestone_id && video.milestone_id !== record.milestone_id) throw new Error(`Wrong footage round: ${name}`);
      if (!video.title || !video.scope) throw new Error(`Missing footage description: ${name}`);
      const verified = { ...video, product_id: detail.product_id, milestone_id: record.milestone_id, milestone_date: record.date, verified_at: normalized.checked_at, node_link_status: "matched" };
      detail.gameplay_videos = [...list(detail.gameplay_videos).filter(item => item.url !== video.url), verified];
    }
    normalized.urls = normalized.urls || list(normalized.videos).map(video => video.url);
    if (normalized.status === "matched" && !normalized.urls.every(url => list(detail.gameplay_videos).some(video => video.url === url && video.milestone_id === record.milestone_id && video.evidence_kind === "video"))) throw new Error(`Unverified matched footage: ${name}`);
    if (normalized.status !== "blocked" && !reviewIsComplete(normalized, record)) throw new Error(`Incomplete search evidence: ${name}`);
    archive.reviews[record.milestone_id] = normalized;
    record.media_review = normalized;
  }
  return archive;
}
export function validateContent(dashboard, games, previous, archive, decisions = { decisions: [] }) {
  const errors = [];
  const products = new Map(list(games.games).map(game => [game.name, game]));
  const groups = list(dashboard.pipelineGroups).filter(group => group.name !== "试玩验证样本");
  const names = groups.flatMap(group => group.projects);
  for (const name of new Set(names)) {
    if (names.filter(item => item === name).length > 1) errors.push(`Duplicate primary group: ${name}`);
    if (!dashboard.pipelineDetails?.[name]) errors.push(`Missing detail: ${name}`);
  }
  for (const game of list(dashboard.games)) {
    const source = products.get(game.name);
    if (source && (source.product_id !== game.product_id || source.category !== game.category)) errors.push(`Inconsistent product feeds: ${game.name}`);
  }
  const allStudios = [...list(dashboard.domesticStudios), ...Object.values(dashboard.overseasStudios || {})];
  for (const [name, detail] of Object.entries(dashboard.pipelineDetails || {})) {
    const ids = new Set();
    for (const record of list(detail.testing?.records)) {
      if (record.date && !day(record.date)) errors.push(`Invalid event date: ${name}`);
      if (!record.milestone_id || ids.has(record.milestone_id)) errors.push(`Missing/duplicate milestone identity: ${name}`);
      ids.add(record.milestone_id);
    }
    for (const video of list(detail.gameplay_videos)) {
      if (video.milestone_id && !ids.has(video.milestone_id)) errors.push(`Unknown footage target: ${name} ${video.title}`);
      const record = detail.testing?.records?.find(item => item.milestone_id === video.milestone_id);
      if (record && video.milestone_date && record.date !== video.milestone_date) errors.push(`Wrong footage round: ${name}`);
    }
    const affiliations = allStudios.filter(studio => [studio.name, ...list(studio.company_aliases)].includes(detail.team?.company));
    if (names.includes(name) && detail.team?.sources?.some(source => validUrl(source.url)) && affiliations.length === 1 && !affiliations[0].known_pipeline?.some(value => value.replace(/（[^）]*）\s*$/, "").trim() === name)) errors.push(`Missing studio association: ${name}`);
  }
  for (const [name, detail] of Object.entries(previous?.pipelineDetails || {})) {
    const current = dashboard.pipelineDetails?.[name];
    const removed = decisions.decisions?.some(decision => decision.name === name && decision.action === "remove" && decision.reason && decision.source);
    if (!current && !removed) { errors.push(`Lost verified product: ${name}`); continue; }
    if (!current) continue;
    for (const record of list(detail.testing?.records)) if (!current.testing?.records?.some(item => item.milestone_id === record.milestone_id)) errors.push(`Lost historical milestone: ${name} ${record.title}`);
    for (const video of list(detail.gameplay_videos)) if (!current.gameplay_videos?.some(item => item.url === video.url)) errors.push(`Lost historical footage: ${name}`);
  }
  for (const decision of list(decisions.decisions)) {
    if (decision.action === "exclude" && names.some(name => nameKey(name) === (decision.normalized_name || nameKey(decision.name)))) errors.push(`Excluded candidate admitted: ${decision.name || decision.normalized_name}`);
  }
  for (const name of names.filter(name => previous && !previous.pipelineDetails?.[name])) {
    const detail = dashboard.pipelineDetails[name];
    if (!detail?.analysis?.core_loop || !detail.category || !validUrl(detail.testing?.records?.[0]?.url || detail.team?.sources?.[0]?.url)) errors.push(`Incomplete product admission evidence: ${name}`);
  }
  for (const [name, detail] of Object.entries(dashboard.pipelineDetails || {})) {
    for (const record of list(detail.testing?.records)) {
      const review = archive.reviews?.[record.milestone_id];
      if (reviewIsComplete(review, record) && review.status === "matched" && !review.urls.every(url => list(detail.gameplay_videos).some(video => video.url === url && video.milestone_id === record.milestone_id && video.evidence_kind === "video"))) errors.push(`Missing reviewed footage: ${name}`);
    }
  }
  for (const task of buildMediaQueue(dashboard, previous, archive)) errors.push(`Unreviewed changed ${task.kind}: ${task.product} ${task.title}`);
  return errors;
}
export function runStatus(modules) {
  const values = Object.values(modules);
  if (values.some(module => module.status === "failed")) return "failed";
  if (values.some(module => module.required !== false && !["passed", "no_change"].includes(module.status))) return "degraded";
  return "complete";
}
