import fs from "node:fs";
import path from "node:path";
import { resolveEvidenceRows, recordEvidenceIssue } from "./source-evidence-lib.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cache = new Map(), rejected = [];
for (const [filename, kind] of [["databrain_events.json", "event"], ["databrain_research.json", "research"]]) {
  const file = path.join(root, "public", filename);
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [name, records] of Object.entries(document.games)) {
    const resolved = await resolveEvidenceRows(records, { cache });
    document.games[name] = resolved.filter(record => {
      const reason = recordEvidenceIssue(name, record, kind);
      if (reason) rejected.push({ filename, name, reason, record });
      return !reason;
    });
    if (!document.games[name].length) delete document.games[name];
  }
  const count = Object.values(document.games).reduce((total, records) => total + records.length, 0);
  Object.assign(document.meta, kind === "event" ? { games_with_events: Object.keys(document.games).length, events: count } : { games_with_research: Object.keys(document.games).length, records: count });
  if (kind === "research") {
    document.meta.source_counts = {};
    for (const records of Object.values(document.games)) for (const record of records) document.meta.source_counts[record.source] = (document.meta.source_counts[record.source] || 0) + 1;
  }
  document.meta.evidence_validation = { checked_at: new Date().toISOString(), rejected_records: rejected.filter(row => row.filename === filename).length, policy: "Original links required; placeholder URLs, unavailable search redirects, homonyms and homepage-only event dates are quarantined." };
  fs.writeFileSync(file, JSON.stringify(document, null, 2) + "\n");
}
const audit = path.join(root, ".automation", "source-evidence");
fs.mkdirSync(audit, { recursive: true });
fs.writeFileSync(path.join(audit, "latest.json"), JSON.stringify({ checked_at: new Date().toISOString(), rejected }, null, 2) + "\n");
console.log(JSON.stringify({ rejected_records: rejected.length, audit: path.join(audit, "latest.json") }));
