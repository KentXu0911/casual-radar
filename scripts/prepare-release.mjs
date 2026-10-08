import fs from "node:fs";
import path from "node:path";
import { publicFiles, contentVersion } from "./release-manifest-lib.mjs";

const publicRoot = path.resolve(import.meta.dirname, "../public");
const files = publicFiles(publicRoot);
const version = contentVersion(files);
const target = path.join(publicRoot, "release-manifest.json");
const previous = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target)) : {};
const sourceCommit = process.env.GITHUB_SHA || null;
const manifest = { schema_version: 1, version, source_commit: sourceCommit, generated_at: previous.version === version ? previous.generated_at : new Date().toISOString(), files };
const content = `${JSON.stringify(manifest, null, 2)}\n`;
if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content) fs.writeFileSync(target, content);
console.log(JSON.stringify({ version, source_commit: sourceCommit, resources: Object.keys(files).length }));
