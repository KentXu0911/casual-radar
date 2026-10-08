import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "KentXu0911/casual-radar";
const checkout = path.join(root, ".automation", "github-pages", "repo");
const baselinePath = path.join(root, ".automation", "github-pages", "source-baseline.json");
const folders = ["app", "static", "public", "scripts", "tests", "specs", "worker", "db", "examples", "drizzle", ".github"];
const files = [".gitignore", "README.md", "package.json", "package-lock.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "tsconfig.pages.json", "eslint.config.mjs", "vite.config.ts", "vite.pages.config.ts", "drizzle.config.ts"];

function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status}).`);
  return result.stdout || "";
}

function validatePublicSource(source) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to publish a symlink: ${path.relative(root, source)}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source)) {
      if (name.startsWith(".env") || name === ".git") throw new Error(`Private file inside public source: ${path.relative(root, source)}/${name}`);
      validatePublicSource(path.join(source, name));
    }
    return;
  }
  if (!/\.(?:[cm]?[jt]sx?|json|md|ya?ml|html|css|txt|py)$/.test(source)) return;
  const text = fs.readFileSync(source, "utf8");
  const credentials = /(?<![A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|"(?:access_token|refresh_token|client_secret)"\s*:\s*"[^"\s]+"/;
  if (credentials.test(text)) throw new Error(`Potential credential in ${path.relative(root, source)}; publication stopped.`);
}

const exportOnly = process.argv.includes("--export-only");
const messageIndex = process.argv.indexOf("--message");
const message = messageIndex >= 0 ? process.argv[messageIndex + 1] : `Update Casual Radar ${new Date().toISOString().slice(0, 10)}`;
if (!message) throw new Error("Missing commit message.");

// The original checkout and its uncommitted work are never staged or reset.
for (const name of [...folders, ...files]) validatePublicSource(path.join(root, name));
if (process.argv.includes("--check-only")) {
  console.log("Public source check passed.");
  process.exit(0);
}
if (!exportOnly) run("npm", ["run", "test:pages"]);
fs.mkdirSync(path.dirname(checkout), { recursive: true });
if (!fs.existsSync(path.join(checkout, ".git"))) {
  if (fs.existsSync(checkout) && fs.readdirSync(checkout).length) throw new Error("Publishing checkout already contains files without Git metadata.");
  run("gh", ["repo", "clone", repository, checkout]);
} else {
  if (run("git", ["status", "--porcelain"], checkout, true).trim()) throw new Error("Publishing checkout has uncommitted changes; inspect it before retrying.");
  const origin = run("git", ["remote", "get-url", "origin"], checkout, true).trim();
  if (!origin.endsWith(`${repository}.git`) && !origin.endsWith(repository)) throw new Error("Unexpected publishing repository.");
  run("git", ["pull", "--ff-only", "origin", "main"], checkout);
  const remoteHead = run("git", ["rev-parse", "HEAD"], checkout, true).trim();
  if (fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    if (baseline.commit !== remoteHead) throw new Error("GitHub has newer changes from another run. Merge them into the source before publishing; no source files were overwritten.");
  } else {
    throw new Error("No publishing baseline recorded. Review and synchronize the GitHub source before publishing.");
  }
}
for (const name of [...folders, ...files]) {
  const destination = path.join(checkout, name);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(root, name), destination, { recursive: true });
}
console.log(`Public source exported to ${checkout}`);
if (!exportOnly) {
  run("git", ["add", "--", ...folders, ...files], checkout);
  if (run("git", ["diff", "--cached", "--name-only"], checkout, true).trim()) run("git", ["commit", "-m", message], checkout);
  run("git", ["push", "origin", "HEAD:main"], checkout);
  fs.writeFileSync(baselinePath, `${JSON.stringify({ commit: run("git", ["rev-parse", "HEAD"], checkout, true).trim() }, null, 2)}\n`);
  console.log("GitHub Actions will verify and publish https://kentxu0911.github.io/casual-radar/");
}
