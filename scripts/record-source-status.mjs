import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicationReport, writeRefreshReport } from "./refresh-runner-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name, fallback = "") => {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
};

const cadence = value("--cadence");
const source = value("--source");
const status = value("--status", "blocked");
const reason = value("--reason");
const checkedAt = value("--checked-at", new Date().toISOString());

if (!["daily", "weekly", "intelligence", "monthly"].includes(cadence)) throw new Error("A valid --cadence is required");
if (!/^[a-z][a-z0-9_-]*$/i.test(source)) throw new Error("A valid --source is required");
if (!["blocked", "failed"].includes(status)) throw new Error("--status must be blocked or failed");
if (!reason.trim()) throw new Error("--reason is required");

const ownerPath = path.join(root, ".automation", "content-runs", "active", "owner.json");
if (fs.existsSync(ownerPath)) throw new Error("An active content run exists; update that run instead of writing a source preflight report");

const startedAt = new Date().toISOString();
const report = {
  cadence,
  started_at: startedAt,
  completed_at: startedAt,
  phase: "source_preflight",
  status,
  modules: {
    [source]: { required: true, status, checked_at: checkedAt, reason },
  },
  error: reason,
  publication: publicationReport(null),
};
const reportPath = path.join(root, "reports", `${cadence}-refresh-latest.json`);
writeRefreshReport(reportPath, report);
process.stdout.write(`${JSON.stringify({ cadence, source, status, report: reportPath })}\n`);
