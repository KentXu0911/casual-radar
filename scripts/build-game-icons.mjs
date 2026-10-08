import fs from "node:fs/promises";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const workspaceDir = path.resolve(projectDir, "..");
const gamesPath = path.join(projectDir, "public", "games.json");
const iconDir = path.join(projectDir, "public", "game-icons");
const sourceDir = path.join(workspaceDir, "outputs");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = "") => value
  .normalize("NFKD")
  .toLowerCase()
  .replace(/&/g, "and")
  .replace(/\b(the|game|games|mobile|online|official|3d|app)\b/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, "");

function similarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.18;
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= b.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
  }
  return 1 - rows[a.length][b.length] / Math.max(a.length, b.length);
}

function safeName(value) {
  return normalize(value).slice(0, 70) || "game";
}

async function extractDataBrainIcons() {
  const files = (await fs.readdir(sourceDir)).filter((name) => /^databrain.*\.json$/.test(name));
  const map = new Map();
  for (const file of files) {
    const content = (await fs.readFile(path.join(sourceDir, file), "utf8")).replace(/\\+"/g, '"');
    const pattern = /"(?:name|title)"\s*:\s*"([^"]+?)\s+-\s+(?:数据|KPI趋势)\s+-\s+情报"[\s\S]{0,1800}?"image_url"\s*:\s*"(https:[^"]+)"/g;
    for (const match of content.matchAll(pattern)) map.set(normalize(match[1]), match[2]);
  }
  return map;
}

function bestResult(results, aliases, nameField) {
  let best = null;
  for (const result of results) {
    const score = Math.max(...aliases.map((alias) => similarity(alias, result[nameField] || "")));
    if (!best || score > best.score) best = { result, score };
  }
  return best;
}

async function searchSteam(query, aliases) {
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("l", "english");
  url.searchParams.set("cc", "US");
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) return null;
  const payload = await response.json();
  const best = bestResult(payload.items || [], aliases, "name");
  return best && best.score >= 0.68 ? { url: best.result.tiny_image, source: "steam", match: best.result.name, score: best.score } : null;
}

async function searchItunes(query, aliases, country) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "software");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", "8");
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) return null;
  const payload = await response.json();
  const best = bestResult(payload.results || [], aliases, "trackName");
  if (!best || best.score < 0.68) return null;
  if (/(guide|wiki|companion|dododex|calculator|database|tracker|tools?)/i.test(best.result.trackName || "")) return null;
  const artwork = best.result.artworkUrl512 || best.result.artworkUrl100;
  // App Store search can return a visually similar title (for example Clash
  // Royale for Rush Royale). Keep only strong title matches so a mobile-first
  // refresh never replaces a correct icon with a lookalike result.
  return artwork && best.score >= 0.84 ? { url: artwork.replace(/\/\d+x\d+bb\./, "/512x512bb."), source: `app-store-${country}`, match: best.result.trackName, score: best.score } : null;
}

async function findIcon(game, dataBrain) {
  const aliases = [game.name, game.name_cn, game.name_zh, game.en, game.name_en, ...(Array.isArray(game.aliases) ? game.aliases : [])].filter(Boolean);
  const query = game.en || game.name;
  const platformText = Array.isArray(game.platforms) ? game.platforms.join(" / ") : String(game.platforms || game.platform || "");
  const mobile = /移动|iOS|Android|安卓|鸿蒙/i.test(platformText);
  const pc = /PC|Steam|主机|Xbox|PlayStation|PS5|Nintendo|Switch/i.test(platformText);
  const attempts = [];
  // When a title has a mobile build, prefer its App Store icon over a PC/Steam
  // capsule or a generic cover. This keeps the dashboard's primary visual
  // aligned with the user's requested mobile-first convention.
  if (mobile) attempts.push(() => searchItunes(game.name, aliases, "cn"), () => searchItunes(query, aliases, "us"));
  if (!mobile && pc) attempts.push(() => searchSteam(query, aliases));
  if (!mobile && !pc) attempts.push(() => searchItunes(query, aliases, "us"), () => searchSteam(query, aliases));
  for (const attempt of attempts) {
    try {
      const found = await attempt();
      if (found) return found;
    } catch (error) {
      console.warn(`lookup failed for ${game.name}: ${error.message}`);
    }
    await wait(80);
  }
  // DataBrain remains a useful fallback for titles that have no discoverable
  // App Store or Steam listing, but it is deliberately consulted last.
  for (const alias of aliases) {
    const exact = dataBrain.get(normalize(alias));
    if (exact) return { url: exact, source: "databrain", match: alias, score: 1 };
  }
  return null;
}

async function downloadIcon(icon, fileBase) {
  const response = await fetch(icon.url, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
  const fileName = `${fileBase}.${extension}`;
  await fs.writeFile(path.join(iconDir, fileName), Buffer.from(await response.arrayBuffer()));
  return `/game-icons/${fileName}`;
}

await fs.mkdir(iconDir, { recursive: true });
const payload = JSON.parse(await fs.readFile(gamesPath, "utf8"));
const dataBrain = await extractDataBrainIcons();
const manifest = [];
const refreshMobileOnly = process.argv.includes("--mobile-first-only");
let previousManifest = new Map();
try {
  const previous = JSON.parse(await fs.readFile(path.join(projectDir, "public", "game-icons.json"), "utf8"));
  previousManifest = new Map(previous.map((item) => [item.game, item]));
} catch {
  // A missing manifest is fine on the initial icon build.
}

for (const [index, game] of payload.games.entries()) {
  const platformText = Array.isArray(game.platforms) ? game.platforms.join(" / ") : String(game.platforms || game.platform || "");
  const mobile = /移动|iOS|Android|安卓|鸿蒙/i.test(platformText);
  if (refreshMobileOnly && !mobile) {
    manifest.push(previousManifest.get(game.name) || { game: game.name, path: game.icon_path || null, source: game.icon_source || null });
    console.log(`[${index + 1}/${payload.games.length}] · keep ${game.name}`);
    continue;
  }
  const icon = await findIcon(game, dataBrain);
  if (!icon && refreshMobileOnly) {
    manifest.push(previousManifest.get(game.name) || { game: game.name, path: game.icon_path || null, source: game.icon_source || null });
    console.log(`[${index + 1}/${payload.games.length}] · keep ${game.name} (no stronger mobile match)`);
    continue;
  }
  if (icon) {
    try {
      game.icon_path = await downloadIcon(icon, `${String(index + 1).padStart(3, "0")}-${safeName(game.en || game.name)}`);
      game.icon_source = icon.source;
      manifest.push({ game: game.name, path: game.icon_path, ...icon });
      console.log(`[${index + 1}/${payload.games.length}] ✓ ${game.name} ← ${icon.match}`);
      continue;
    } catch (error) {
      console.warn(`[${index + 1}/${payload.games.length}] download failed ${game.name}: ${error.message}`);
    }
  }
  delete game.icon_path;
  delete game.icon_source;
  manifest.push({ game: game.name, path: null, source: null });
  console.log(`[${index + 1}/${payload.games.length}] · ${game.name}`);
}

payload.meta = { ...(payload.meta || {}), icon_coverage: payload.games.filter((game) => game.icon_path).length, icon_updated_at: new Date().toISOString() };
await fs.writeFile(gamesPath, `${JSON.stringify(payload, null, 2)}\n`);
await fs.writeFile(path.join(projectDir, "public", "game-icons.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`coverage ${payload.meta.icon_coverage}/${payload.games.length}`);
