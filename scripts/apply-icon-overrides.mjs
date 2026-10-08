import fs from "node:fs/promises";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const gamesPath = path.join(projectDir, "public", "games.json");
const manifestPath = path.join(projectDir, "public", "game-icons.json");
const iconDir = path.join(projectDir, "public", "game-icons");

const overrides = new Map([
  ["糖豆人", { url: "https://cdn2.steamgriddb.com/icon_thumb/7effe368dace6405ddee825c0707c434.png", source: "steamgriddb" }],
  ["逃跑吧！少年", { url: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/29/ab/ad/29abad51-4843-4425-0053-97a47021ce19/AppIcon-1x_U007emarketing-0-8-0-85-220-0.png/512x512bb.png", source: "app-store-cn" }],
  ["蛋仔滑滑", { itunesId: "6451399447", source: "app-store-cn" }],
  ["炉石传说：酒馆战棋", { url: "https://cdn.mobygames.com/covers/7007385-hearthstone-heroes-of-warcraft-iphone-front-cover.jpg", source: "hearthstone-official-art" }],
  ["药剂工艺", { url: "https://cdn2.steamgriddb.com/icon/e584bd1926df576b6c47ef4a319e432f/32/1024x1024.png", source: "steamgriddb" }],
  ["TopTop", { url: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/80/a6/f6/80a6f656-0704-9908-3f05-a6674295d676/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.png", source: "app-store" }],
  ["Dread Hunger", { url: "https://cdn.akamai.steamstatic.com/steam/apps/1418630/header.jpg", source: "steam" }],
  ["Zooba", { url: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/04/ca/0f/04ca0f94-a830-63c9-4ec4-5fa502aeebc2/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.png", source: "app-store" }],
  ["I Am Sword", { url: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/5d/c6/97/5dc697dd-e307-95a7-4ed9-83aad098547a/Placeholder.mill/512x512bb.jpg", source: "app-store" }],
  ["Plinko Defense", { url: "https://image.winudf.com/v2/image1/Y29tLnN1cGVybWFnaWMuYW9zLnplYWxvdF9pY29uXzE3NjYwNzQzMTFfMDA3/icon.png?w=360&fakeurl=1", source: "google-play-mirror" }],
  ["裂隙远征", { url: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4425970/19f2fde865dafdd6f7e1b0e73f991e918f6a97a0/header_schinese.jpg?t=1786377076", source: "steam-official" }],
  ["朋友收集 梦想生活", { url: "https://image-assets.m.nintendo.com/d66d6453-519f-47bc-86a9-349683fc59f6", source: "nintendo" }],
]);

async function resolveUrl(item) {
  if (item.url) return item.url;
  const response = await fetch(`https://itunes.apple.com/lookup?id=${item.itunesId}&country=cn`);
  if (!response.ok) throw new Error(`iTunes lookup ${response.status}`);
  const payload = await response.json();
  const result = payload.results?.[0];
  if (!result) throw new Error("iTunes result missing");
  return (result.artworkUrl512 || result.artworkUrl100).replace(/\/\d+x\d+bb\./, "/512x512bb.");
}

async function download(url, baseName) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const type = response.headers.get("content-type") || "";
  const extension = type.includes("webp") ? "webp" : type.includes("png") ? "png" : "jpg";
  const fileName = `${baseName}.${extension}`;
  await fs.writeFile(path.join(iconDir, fileName), Buffer.from(await response.arrayBuffer()));
  return `/game-icons/${fileName}`;
}

const payload = JSON.parse(await fs.readFile(gamesPath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const byGame = new Map(manifest.map((item) => [item.game, item]));

for (const [name, item] of overrides) {
  const game = payload.games.find((entry) => entry.name === name);
  if (!game) continue;
  const url = await resolveUrl(item);
  const iconPath = await download(url, `override-${game.name.replace(/[^\p{L}\p{N}]+/gu, "-")}`);
  game.icon_path = iconPath;
  game.icon_source = item.source;
  byGame.set(name, { game: name, path: iconPath, url, source: item.source, match: name, score: 1 });
  console.log(`✓ ${name}`);
}

payload.meta = {
  ...(payload.meta || {}),
  icon_coverage: payload.games.filter((game) => game.icon_path).length,
  icon_updated_at: new Date().toISOString(),
};
await fs.writeFile(gamesPath, `${JSON.stringify(payload, null, 2)}\n`);
await fs.writeFile(manifestPath, `${JSON.stringify(payload.games.map((game) => byGame.get(game.name) || { game: game.name, path: null, source: null }), null, 2)}\n`);
console.log(`coverage ${payload.meta.icon_coverage}/${payload.games.length}`);
