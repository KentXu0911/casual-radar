import { evidenceUrlIssue, isLowConfidenceEventSource, isUnrelatedProductEvidence } from "./weekly-refresh-lib.mjs";

export function recordEvidenceIssue(name, record, kind = "research") {
  const issue = evidenceUrlIssue(record.url);
  if (issue) return issue;
  if (String(record.url).startsWith("https://vertexaisearch.cloud.google.com/grounding-api-redirect/")) return "unresolved_search_redirect";
  if (record.source_link_status === "unresolved") return "unresolved_source_link";
  if (isLowConfidenceEventSource(record.source, record.url)) return "low_confidence_source";
  if (isUnrelatedProductEvidence(name, record.title, record.summary)) return "identity_conflict";
  const url = new URL(record.url);
  if (kind === "event" && url.pathname === "/" && !record.evidence_quote) return "homepage_does_not_prove_event_date";
  return "";
}

export async function resolveEvidenceRows(rows, options = {}) {
  const fetcher = options.fetcher || fetch;
  const cache = options.cache || new Map();
  const urlOf = row => String(row.url || row.source_url || row.link || "").match(/https?:\/\/[^\s)]+/)?.[0] || "";
  const pending = [...new Set(rows.map(urlOf).filter(url => /^https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//.test(url)))];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (next < pending.length) {
      const url = pending[next++];
      if (cache.has(url)) continue;
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
        await response.body?.cancel();
        cache.set(url, response.ok && response.url && !response.url.includes("grounding-api-redirect") ? response.url : null);
      } catch { cache.set(url, null); }
    }
  }));
  return rows.map(row => {
    const original = urlOf(row);
    if (!cache.has(original)) return row;
    const resolved = cache.get(original);
    return resolved ? { ...row, original_url: original, url: resolved } : { ...row, source_link_status: "unresolved" };
  });
}
