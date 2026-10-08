import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export function publicFiles(publicRoot) {
  const files = {};
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error("Public resources cannot be symlinks");
      if (stat.isDirectory()) visit(file);
      else if (name !== "release-manifest.json") files[path.relative(publicRoot, file).replaceAll(path.sep, "/")] = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    }
  }
  visit(publicRoot);
  return files;
}
export const contentVersion = files => createHash("sha256").update(JSON.stringify(files)).digest("hex").slice(0, 20);
