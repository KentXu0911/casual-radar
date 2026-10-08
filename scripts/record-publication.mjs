import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeRefreshReport } from "./refresh-runner-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = "") {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const cadence = arg("--cadence", "weekly");
if (!new Set(["daily", "weekly"]).has(cadence)) throw new Error(`不支持的发布报告类型：${cadence}`);
const reportPath = path.resolve(arg("--report", path.join(siteRoot, "reports", `${cadence}-refresh-latest.json`)));
const status = arg("--status", "succeeded");
const url = arg("--url");
if (!fs.existsSync(reportPath)) throw new Error(`刷新报告不存在：${reportPath}`);
if (status === "succeeded" && !/^https:\/\//.test(url)) throw new Error("发布成功时必须提供 HTTPS 站点地址。");

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const provider = arg("--provider", report.publication?.provider || "openai_sites");
if (!new Set(["github_pages", "openai_sites"]).has(provider)) throw new Error(`不支持的发布平台：${provider}`);
if (status === "succeeded" && report.status !== "complete") {
  throw new Error(`刷新报告状态为 ${report.status || "unknown"}，只有 complete 报告可以记录成功发布。`);
}
if (status === "succeeded" && provider === "openai_sites" && (!arg("--version-id") || !arg("--deployment-id"))) {
  throw new Error("发布成功时必须同时提供 Sites 版本 ID 与部署 ID。");
}
if (status === "succeeded" && provider === "github_pages" && (!/^[a-f0-9]{40}$/i.test(arg("--commit-sha")) || !/^\d+$/.test(arg("--run-id")))) {
  throw new Error("GitHub 发布成功时必须提供完整 commit SHA 和 Actions run ID。");
}
report.publication = {
  ...(report.publication || {}),
  provider,
  status,
  ...(provider === "github_pages" ? {
    repository: "KentXu0911/casual-radar",
    commit_sha: arg("--commit-sha") || null,
    workflow_run_id: arg("--run-id") || null,
    workflow_run_url: arg("--run-id") ? `https://github.com/KentXu0911/casual-radar/actions/runs/${arg("--run-id")}` : null,
  } : {
    version_id: arg("--version-id") || null,
    deployment_id: arg("--deployment-id") || null,
  }),
  url: url || null,
  checked_at: new Date().toISOString(),
  health_check: status === "succeeded" ? (provider === "github_pages" ? "github_actions_succeeded" : "sites_deployment_succeeded") : "failed",
  ...(arg("--error") ? { error: arg("--error") } : {}),
};
const history = writeRefreshReport(reportPath, report);
process.stdout.write(`${JSON.stringify({ report: reportPath, history, publication: report.publication })}\n`);
