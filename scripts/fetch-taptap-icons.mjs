import fs from "node:fs/promises";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const gamesPath = path.join(projectDir, "public", "games.json");
const manifestPath = path.join(projectDir, "public", "game-icons.json");
const iconDir = path.join(projectDir, "public", "game-icons");
const pipelineIconsPath = path.join(projectDir, "public", "pipeline-icons.json");

const entries = [
  ["粒粒的小人国", 772909],
  ["王者万象棋", 243110],
  ["山海奇旅", 719198],
  ["诡影藏锋", 874444],
  ["星绘友晴天", 756412],
  ["雾海之下", 894881],
  ["星布谷地", 776320],
  ["崩坏：因缘精灵", 753921],
  ["生活派对", 387202],
  ["塔塔冒险队", 866257],
  ["小冰冰斗蛐蛐", 882847],
  ["妖妖棋", 756756],
  ["代号：Team2", 831809],
];

// A small number of pipeline projects do not have a TapTap page. Keep their
// verified store artwork in the same manifest so the overview and detail page
// never fall back to a letter avatar.
const directEntries = [
  ["Totally Mall", {
    imageUrl: "https://play-lh.googleusercontent.com/22vX4xsgsS7XodgyXIuEdYuvoMSLGwjfE8j_ieSEqj3rc6TYCXaiUCKs94g9DUh3CMS--ppxvOn0DzTwonD39w=s0-br30",
    pageUrl: "https://play.google.com/store/apps/details?id=com.farlightgames.spark.gp",
    source: "google-play",
  }],
];

const localEntries = [
  ["集合！浆果镇", {
    path: "/game-icons/placeholder-berry.svg",
    pageUrl: "https://www.taptap.cn/moment/829083364769136788?group_id=1200532",
    title: "集合！浆果镇",
    source: "editorial-placeholder",
  }],
];

const safeName = (value) => value.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();

async function fetchIcon(appId) {
  const pageUrl = `https://www.taptap.cn/app/${appId}`;
  const page = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!page.ok) throw new Error(`TapTap page ${page.status}`);
  const html = await page.text();
  const image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s+-\s+(?:官方预约|官方参与测试)\s+-\s+TapTap$/, "").trim();
  if (!image) throw new Error("TapTap app icon missing");
  const response = await fetch(image, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) throw new Error(`TapTap icon ${response.status}`);
  const type = response.headers.get("content-type") || "";
  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const fileName = `taptap-${appId}.${extension}`;
  await fs.writeFile(path.join(iconDir, fileName), Buffer.from(await response.arrayBuffer()));
  return { path: `/game-icons/${fileName}`, imageUrl: image, pageUrl, title };
}

async function fetchDirectIcon(name, item) {
  const response = await fetch(item.imageUrl, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) throw new Error(`direct icon ${response.status}`);
  const type = response.headers.get("content-type") || "";
  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const fileName = `pipeline-${safeName(name)}.${extension}`;
  await fs.writeFile(path.join(iconDir, fileName), Buffer.from(await response.arrayBuffer()));
  return { path: `/game-icons/${fileName}`, ...item, title: name };
}

await fs.mkdir(iconDir, { recursive: true });
const payload = JSON.parse(await fs.readFile(gamesPath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const byGame = new Map(manifest.map((item) => [item.game, item]));
const pipelineIcons = {};

for (const [name, appId] of entries) {
  const icon = await fetchIcon(appId);
  pipelineIcons[name] = { ...icon, source: "taptap", appId };
  const game = payload.games.find((item) => item.name === name);
  if (game) {
    game.icon_path = icon.path;
    game.icon_source = "taptap";
    byGame.set(name, { game: name, path: icon.path, url: icon.imageUrl, source: "taptap", match: icon.title || name, score: 1, app_url: icon.pageUrl });
  }
  console.log(`✓ ${name} ← TapTap ${appId}`);
}

for (const [name, item] of directEntries) {
  const icon = await fetchDirectIcon(name, item);
  pipelineIcons[name] = icon;
  console.log(`✓ ${name} ← ${item.source}`);
}

for (const [name, item] of localEntries) {
  pipelineIcons[name] = item;
  console.log(`✓ ${name} ← ${item.source}`);
}

await fs.writeFile(gamesPath, `${JSON.stringify(payload, null, 2)}\n`);
await fs.writeFile(manifestPath, `${JSON.stringify(payload.games.map((game) => byGame.get(game.name) || { game: game.name, path: null, source: null }), null, 2)}\n`);
await fs.writeFile(pipelineIconsPath, `${JSON.stringify(pipelineIcons, null, 2)}\n`);
console.log(`wrote ${Object.keys(pipelineIcons).length} pipeline icons`);
