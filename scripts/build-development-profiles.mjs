import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");

const [gameBundle, dashboard, pcMetricBundle, existingProfiles] = await Promise.all([
  readJson("games.json"),
  readJson("dashboard_data.json"),
  readJson("pc-metrics.json"),
  readJson("development-profiles.json"),
]);

const OFFICIAL_SOURCE_OVERRIDES = {
  "宝可梦大集结": {
    label: "TiMi Studio Group｜Pokémon UNITE",
    url: "https://www.timistudios.com/games/pokemon-unite",
  },
  "T3 Arena": {
    label: "XD｜About Us",
    url: "https://www.xd.com/about-us/?lang=en",
  },
  "SMASH LEGENDS": {
    label: "Steam｜SMASH LEGENDS",
    url: "https://store.steampowered.com/app/1352080/SMASH_LEGENDS/",
  },
  Zooba: {
    label: "Wildlife Studios｜Zooba",
    url: "https://wildlifestudios.com/games/zooba/",
  },
  "FRAG Pro Shooter": {
    label: "App Store｜FRAG Pro Shooter",
    url: "https://apps.apple.com/us/app/frag-pro-shooter/id1314391359",
  },
  "炉石传说：酒馆战棋": {
    label: "Blizzard｜Introducing Hearthstone Battlegrounds",
    url: "https://news.blizzard.com/en-gb/article/23156373/introducing-hearthstone-battlegrounds",
  },
  "Bag Fight": {
    label: "Steam｜Bag Fight",
    url: "https://store.steampowered.com/app/4461770/Bag_Fight/",
  },
};

const DEVELOPER_OVERRIDES = {
  "Faaast Penguin": {
    company: "historia Inc.",
    publisher: "historia Inc.",
    country: "日本",
    source: { label: "Steam｜Faaast Penguin", url: "https://store.steampowered.com/app/2590150/Faaast_Penguin/" },
  },
  "逃跑吧！少年": {
    company: "深圳市抱一网络科技有限公司",
    publisher: "深圳市抱一网络科技有限公司",
    source: { label: "App Store｜逃跑吧！少年", url: "https://apps.apple.com/cn/app/id1409592512" },
  },
  "七龙珠：破界斗士": {
    company: "Dimps Corporation",
    publisher: "Bandai Namco Entertainment",
    source: { label: "Steam｜DRAGON BALL: THE BREAKERS", url: "https://store.steampowered.com/app/1276760/DRAGON_BALL_THE_BREAKERS/" },
  },
  "Rush Royale": {
    company: "IT Territory（MY.GAMES）",
    developer: "IT Territory",
    publisher: "MY.GAMES",
    source: { label: "MY.GAMES｜2021 Q1 业务资料", url: "https://corp.imgsmail.ru/media/files/1q21-marketing-pack.pdf" },
  },
  "随机骰子": {
    company: "111%",
    publisher: "111%",
    country: "韩国",
    source: { label: "App Store｜Random Dice: Defense", url: "https://apps.apple.com/us/app/random-dice-defense/id1462877149" },
  },
  "背包乱斗": {
    company: "PlayWithFurcifer",
    publisher: "IndieArk / Shochiku",
    source: { label: "Steam｜Backpack Battles", url: "https://store.steampowered.com/app/2427700/Backpack_Battles/" },
  },
  "King of the Castle": {
    company: "Tributary Games",
    publisher: "Team17",
    source: { label: "Steam｜King of the Castle", url: "https://store.steampowered.com/app/1839880/King_Of_The_Castle/" },
  },
  "药剂工艺": {
    company: "niceplay games",
    publisher: "tinyBuild",
    source: { label: "Steam｜Potion Craft", url: "https://store.steampowered.com/app/1210320/Potion_Craft_Alchemist_Simulator/" },
  },
  "Pocket Champs": {
    company: "Madbox",
    publisher: "Madbox",
    country: "法国",
    source: { label: "Madbox｜Pocket Champs", url: "https://madbox.io/" },
  },
  "Luma Island": {
    company: "Feel Free Games",
    publisher: "Feel Free Games",
    country: "荷兰",
    source: { label: "Steam｜Luma Island", url: "https://store.steampowered.com/app/2408820/Luma_Island/" },
  },
  "创世理想乡": {
    company: "Pocketpair",
    publisher: "Pocketpair",
    country: "日本",
    source: { label: "Steam｜Craftopia", url: "https://store.steampowered.com/app/1307550/Craftopia/" },
  },
  BigWalk: {
    company: "House House",
    publisher: "Panic",
    country: "澳大利亚",
    release_date: "2026-08-04",
    source: { label: "Big Walk｜官方产品页", url: "https://walk.game/" },
  },
};

const DEEP_PROFILE_OVERRIDES = {
  BigWalk: {
    company: "House House",
    team: "House House《Big Walk》核心团队",
    team_note: "官方 credits 列出 House House 4 名核心成员，并单列环境美术、声音、移植、QA 与发行支持；不把外部支持人员并入核心研发人数",
    early_team_size: "核心 4 人；另有 1 名环境美术协作及专项外部支持",
    producer: "未公开",
    development_cycle: "未公开",
    prior_experience: "House House 曾开发《Untitled Goose Game》",
    confidence: "高置信度",
    sources: [
      { label: "Big Walk｜官方 Credits", url: "https://bigwalk.game/credits/", note: "核心团队名单与专项协作分工" },
      { label: "Big Walk｜官方产品页", url: "https://walk.game/", note: "开发商 House House、发行商 Panic 与产品归属" },
    ],
  },
};

const pipelineNames = new Set((dashboard.pipelineGroups || []).flatMap((group) => group.projects));
const pipelineStatus = /在研|研发|测试|首测|二测|内测|删档|不删档|冒泡|预约|未上线|Early Access|\bEA\b|试玩|上线前|上线验证|公测预约/u;
const releasedGames = (gameBundle.games || []).filter((game) => isReleasedProduct(game, pipelineNames));
const releasedNames = new Set(releasedGames.map((game) => game.name));
const pcMetrics = pcMetricBundle.games || {};

for (const name of Object.keys(existingProfiles)) {
  if (!releasedNames.has(name)) throw new Error(`Development profile is not a released product: ${name}`);
}

const profiles = {};
for (const game of releasedGames) {
  const storedProfile = existingProfiles[game.name];
  const storedDetailedProfile = storedProfile && storedProfile.coverage_level !== "基础归属"
    ? storedProfile
    : undefined;
  const sourcedPromotionProfile = game.source?.includes("游研所 MCP") ? game.development_profile : undefined;
  const detailed = DEEP_PROFILE_OVERRIDES[game.name] || sourcedPromotionProfile || storedDetailedProfile || game.development_profile;
  if (detailed) {
    profiles[game.name] = { ...detailed, coverage_level: "深度档案" };
    continue;
  }

  const ownershipOverride = DEVELOPER_OVERRIDES[game.name];
  const developer = ownershipOverride?.company || game.developer || game.profile?.developer;
  const source = ownershipOverride?.source || OFFICIAL_SOURCE_OVERRIDES[game.name] || bestExistingSource(game, pcMetrics[game.name]);
  if (!developer) throw new Error(`Released product has no developer: ${game.name}`);
  if (!source?.url?.startsWith("https://")) throw new Error(`Released product has no verifiable source URL: ${game.name}`);

  profiles[game.name] = {
    company: developer,
    team: developer === "未公开" ? "研发团队未公开" : `${developer}（公开开发主体）`,
    team_note: developer === "未公开"
      ? "当前信源仅确认产品与商店上架主体；实际研发主体、项目组和团队规模未见可靠公开披露"
      : "当前信源仅确认产品与公开开发主体；具体项目组、工作室归属、负责人和团队规模未见可靠公开披露",
    early_team_size: "未公开",
    producer: "未公开",
    development_cycle: "未公开",
    prior_experience: "未公开；待补充可核验的同团队履历",
    confidence: "基础归属",
    coverage_level: "基础归属",
    sources: [{
      label: source.label,
      url: source.url,
      note: developer === "未公开"
        ? "仅用于核验产品与商店上架主体；不用于推断实际研发主体、项目组、人数、负责人或研发周期"
        : "用于核验产品与公开开发主体；不用于推断具体项目组、人数、负责人或研发周期",
    }],
  };
}

for (const game of gameBundle.games || []) {
  const correction = DEVELOPER_OVERRIDES[game.name];
  if (!correction) continue;
  const developer = correction.developer || correction.company;
  game.developer = developer;
  game.publisher = correction.publisher;
  game.profile = {
    ...(game.profile || {}),
    developer,
    publisher: correction.publisher,
    ...(correction.country ? { country: correction.country } : {}),
    ...(correction.release_date ? { release_date: correction.release_date } : {}),
  };
}

if (Object.keys(profiles).length !== releasedGames.length) {
  throw new Error(`Coverage mismatch: ${Object.keys(profiles).length}/${releasedGames.length}`);
}

await Promise.all([
  writeFile(
    path.join(publicDir, "development-profiles.json"),
    `${JSON.stringify(profiles, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    path.join(publicDir, "games.json"),
    `${JSON.stringify(gameBundle, null, 2)}\n`,
    "utf8",
  ),
]);

const detailedCount = Object.values(profiles).filter((profile) => profile.coverage_level === "深度档案").length;
console.log(`Wrote ${Object.keys(profiles).length} profiles (${detailedCount} deep, ${Object.keys(profiles).length - detailedCount} basic).`);

async function readJson(filename) {
  return JSON.parse(await readFile(path.join(publicDir, filename), "utf8"));
}

function isReleasedProduct(game, namesInPipeline) {
  if (game.alias_of) return false;
  const lifecycle = game.lifecycle && typeof game.lifecycle === "object" ? game.lifecycle : {};
  const statusText = `${game.release_status || ""} ${game.status || ""} ${lifecycle.stage || ""} ${lifecycle.reason || ""}`;
  if (lifecycle.pipeline === false && /已上线|公测|活跃|运营中/.test(statusText)) return true;
  if (namesInPipeline.has(game.name) || lifecycle.pipeline === true) return false;
  if (pipelineStatus.test(statusText)) return false;
  return /已上线|公测|活跃|运营中/.test(statusText);
}

function bestExistingSource(game, pcMetric) {
  const items = [];
  for (const field of ["recent_articles", "recent_updates", "resources"]) {
    for (const item of game.intelligence?.[field] || []) {
      if (item?.url?.startsWith("https://")) {
        items.push({
          label: sourceLabel(item, game.name),
          url: item.url,
          score: sourceScore(item.url),
        });
      }
    }
  }
  if (pcMetric?.source_url?.startsWith("https://")) {
    items.push({
      label: `${pcMetric.source || "DataBrain"}｜${game.name} 数据页`,
      url: pcMetric.source_url,
      score: sourceScore(pcMetric.source_url),
    });
  }
  return items.sort((a, b) => b.score - a.score)[0];
}

function sourceLabel(item, gameName) {
  const source = item.source || item.type || "公开资料";
  return `${source}｜${item.title || gameName}`;
}

function sourceScore(url) {
  const hostname = new URL(url).hostname;
  if (/store\.steampowered\.com|apps\.apple\.com|play\.google\.com/.test(hostname)) return 5;
  if (/databrain\.woa\.com/.test(hostname)) return 4;
  if (/bilibili\.com|youtube\.com/.test(hostname)) return 1;
  if (/mp\.weixin\.qq\.com|toutiao\.com/.test(hostname)) return 2;
  return 3;
}
