import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(publicDir, name), "utf8"));
const writeJson = (name, value) => fs.writeFileSync(path.join(publicDir, name), `${JSON.stringify(value, null, 2)}\n`);

const sources = {
  youyansuo: "https://ai.xianjianwendao.com/kb/mcp/mcp",
  lumiStore: "https://apps.apple.com/cn/app/%E9%97%AA%E8%80%80%E5%90%A7-%E5%99%9C%E5%92%AA/id6754912970",
  ourNotesStore: "https://apps.apple.com/us/app/bang-dream-our-notes/id6757695187",
  lumi: "http://mp.weixin.qq.com/s?__biz=MjM5NTIzNjA2MA==&mid=2651810973&idx=1&sn=4f9660c4dacbf71f68be409b5d05007a&chksm=bcbf34f3086685e1685d21a939fd183b40443041508008eb0af8e4de66b1e4ad5776d9d459a3&scene=126&sessionid=0#rd",
  ourNotes: "http://mp.weixin.qq.com/s?__biz=MjM5NTIzNjA2MA==&mid=2651811171&idx=1&sn=ee2162343fda0fb87cd0317ce5b04cb2&chksm=bc3a1c8c0cbf7f322b2c96b0101194c6ce41c55edf48a1cccd7ee865eec44e690aad3716513e&scene=126&sessionid=0#rd",
};

const articleResource = (title, url, date, summary) => ({
  title,
  url,
  type: "游研所 MCP / 公众号原文",
  source: "游研所",
  date,
  summary,
});

const products = [
  {
    name: "闪耀吧！噜咪",
    name_cn: "闪耀吧！噜咪",
    aliases: ["闪耀吧！噜咪", "噜咪"],
    en: "闪耀吧！噜咪",
    name_en: "",
    track: "新品发现",
    category: "捉宠类",
    sub: "宠物收集/卡牌养成/轻度放置",
    mode: "单人",
    platform: "iOS/微信小游戏",
    platforms: ["iOS", "微信小游戏"],
    year: 2026,
    status: "已公测",
    release_status: "已公测",
    release_date: "2026-09-17",
    developer: "未公开",
    publisher: "Shanghai Hode Information Technology Co.,Ltd.（App Store 所列发行主体）",
    source: "游研所 MCP / 公众号原文",
    pool: "边界观察池",
    why: "游研所新品发现：宠物收集与卡牌养成结合，已在 iOS 与微信小游戏公测，作为捉宠赛道竞品观察。",
    description: "哔哩哔哩游戏发行的宠物收集与养成产品，围绕收集、进化、半自动回合战斗和赛季内容构成轻量循环。",
    traits: ["收集养成", "轻量进入", "赛季内容"],
    profile: {
      developer: "未公开",
      publisher: "Shanghai Hode Information Technology Co.,Ltd.（App Store 所列发行主体）",
      platforms: ["iOS", "微信小游戏"],
      release_status: "已公测",
      release_date: "2026-09-17",
      data_source: "游研所 MCP 检索 + 公众号原文",
      gameplay: "宠物收集、进化与半自动回合战斗，配合赛季内容和轻量放置循环。",
      source_url: [
        { title: "App Store 中国区：闪耀吧！噜咪", url: sources.lumiStore, type: "官方商店" },
        { title: "游研所文章：B站又一款新游跑出来了", url: sources.lumi, type: "公众号原文" },
        { title: "游研所 MCP 服务", url: sources.youyansuo, type: "MCP 数据源" },
      ],
    },
    intelligence: {
      media_coverage: 1,
      latest_date: "2026-09-17",
      recent_articles: [articleResource("B站又一款新游跑出来了", sources.lumi, "2026-09-17", "文章披露产品已公测，并介绍宠物收集、进化、半自动战斗和赛季更新方向。")],
      resources: [
        { title: "App Store 中国区：闪耀吧！噜咪", url: sources.lumiStore, type: "官方商店" },
        { title: "游研所文章：B站又一款新游跑出来了", url: sources.lumi, type: "公众号原文" },
        { title: "游研所 MCP 服务", url: sources.youyansuo, type: "MCP 数据源" },
      ],
      status: "已由游研所文章与 MCP 游戏目录交叉核验；暂无运营指标。",
    },
    data_coverage: {
      metrics_fields: [],
      metrics_status: "暂无可用运营指标",
      metrics_source: "",
      next_source: "游研所 MCP / 官方商店后续刷新",
      catalog_match: "matched；MCP 返回 iOS 与微信小游戏条目",
    },
    metrics: {},
    lifecycle: {
      pipeline: false,
      stage: "已公测",
      stage_date: "2026-09-17",
      reason: "新品发现候选，已进入捉宠类竞品观察，不计入在研项目。",
    },
    icon_path: "/game-icons/youyansuo-lumi.jpg",
    icon_source: "App Store 中国区 · id6754912970",
  },
  {
    name: "BanG Dream! Our Notes",
    name_cn: "BanG Dream! Our Notes",
    aliases: ["BanG Dream! Our Notes", "Our Notes"],
    en: "BanG Dream! Our Notes",
    name_en: "BanG Dream! Our Notes",
    track: "新品发现",
    category: "社交-多人合作类",
    sub: "多人合作/音游",
    mode: "多人",
    platform: "iOS",
    platforms: ["iOS"],
    year: 2026,
    status: "已全球公测",
    release_status: "已全球公测",
    release_date: "2026-09-24",
    developer: "未公开",
    publisher: "BILIBILI HK LIMITED（App Store 所列发行主体）",
    source: "游研所 MCP / 公众号原文",
    pool: "边界观察池",
    why: "游研所新品发现：成熟 IP 的多人合作音游，已全球公测，作为社交多人与音游融合方向观察样本。",
    description: "BanG Dream! IP 多人合作音游，围绕乐队与角色收集、五人实时联机和音乐演出构成核心体验。",
    traits: ["成熟 IP", "五人实时联机", "音游融合"],
    profile: {
      developer: "未公开",
      publisher: "BILIBILI HK LIMITED（App Store 所列发行主体）",
      platforms: ["iOS"],
      release_status: "已全球公测",
      release_date: "2026-09-24",
      data_source: "游研所 MCP 检索 + 公众号原文",
      gameplay: "围绕乐队和角色收集的多人合作音游，支持最多 5 人实时联机。",
      catalog_match: "matched；MCP 的 ios_us / ios_kr 条目经 App Store 核实为同一应用 ID 6757695187。",
      source_url: [
        { title: "App Store 美国区：BanG Dream! Our Notes", url: sources.ourNotesStore, type: "官方商店" },
        { title: "游研所文章：双番2亿播放后，B站又拿出了11年IP的新作", url: sources.ourNotes, type: "公众号原文" },
        { title: "游研所 MCP 服务", url: sources.youyansuo, type: "MCP 数据源" },
      ],
    },
    intelligence: {
      media_coverage: 1,
      latest_date: "2026-09-24",
      recent_articles: [articleResource("双番2亿播放后，B站又拿出了11年IP的新作", sources.ourNotes, "2026-09-24", "文章披露产品全球公测、预约规模和五人实时联机方向。")],
      resources: [
        { title: "App Store 美国区：BanG Dream! Our Notes", url: sources.ourNotesStore, type: "官方商店" },
        { title: "游研所文章：双番2亿播放后，B站又拿出了11年IP的新作", url: sources.ourNotes, type: "公众号原文" },
        { title: "游研所 MCP 服务", url: sources.youyansuo, type: "MCP 数据源" },
      ],
      status: "文章与 MCP 条目已关联；美区和韩区 App Store 使用同一应用 ID，地区差异已核实为本地化。",
    },
    data_coverage: {
      metrics_fields: [],
      metrics_status: "暂无可用运营指标",
      metrics_source: "",
      next_source: "游研所 MCP / 官方商店后续刷新",
      catalog_match: "matched；ios_us 与 ios_kr 均为 App Store 应用 ID 6757695187",
    },
    metrics: {},
    lifecycle: {
      pipeline: false,
      stage: "已全球公测",
      stage_date: "2026-09-24",
      reason: "新品发现候选，已进入社交多人合作竞品观察，不计入在研项目。",
    },
    identity_status: "matched_by_store_id",
    icon_path: "/game-icons/youyansuo-our-notes.jpg",
    icon_source: "App Store 美国区 · id6757695187",
  },
];

const gamesDocument = readJson("games.json");
const dashboardDocument = readJson("dashboard_data.json");
const intakeDocument = readJson("game-intake.json");

for (const product of products) {
  const upsert = (items) => {
    const index = items.findIndex((item) => item.name === product.name);
    if (index === -1) items.push(product);
    else items[index] = { ...items[index], ...product };
  };
  upsert(gamesDocument.games);
  upsert(dashboardDocument.games);
}

intakeDocument["闪耀吧！噜咪"] = {
  added_on: "2026-09-28",
  summary: "新品发现：已公测的宠物收集/养成产品；游研所 MCP 条目与公众号原文已关联。",
};
intakeDocument["BanG Dream! Our Notes"] = {
  added_on: "2026-09-28",
  summary: "新品发现：已全球公测的多人合作音游；美区与韩区 App Store 应用 ID 一致。",
};

gamesDocument.meta = {
  ...gamesDocument.meta,
  total_games: gamesDocument.games.length,
  icon_coverage: gamesDocument.games.filter((game) => game.icon_path).length,
};
writeJson("games.json", gamesDocument);
writeJson("dashboard_data.json", dashboardDocument);
writeJson("game-intake.json", intakeDocument);

console.log(JSON.stringify({
  updated: products.map((product) => product.name),
  games: gamesDocument.games.length,
  dashboard_games: dashboardDocument.games.length,
  intake: Object.keys(intakeDocument).length,
}, null, 2));
