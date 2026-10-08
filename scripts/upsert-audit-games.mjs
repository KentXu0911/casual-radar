import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncGrpReports } from "./grp-report-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const auditSource = "https://databrain.woa.com/v2/agent/chat?sessionId=skill_09f511f526504d2e";
const aliasAuditSource = "https://databrain.woa.com/v2/agent/chat?sessionId=skill_06ded6fb7a144f11";
const aliasMetricsSource = "https://databrain.woa.com/v2/agent/chat?sessionId=dashboard_metrics_e0ed5123450647168bafe053a295f891";
const steam = (id) => `https://store.steampowered.com/app/${id}/`;
const steamImage = (id, suffix = "header.jpg") => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/${suffix}`;

const rows = [
  ["多多自走棋", "Auto Chess", "自走棋", "多人自走棋", "Drodo Studio / 成都龙渊网络", "成都龙渊网络", "移动/PC/主机", ["iOS", "Android", "PC", "PlayStation"], "2019-05-31", "主追踪池", "自走棋品类的开创性产品与长期运营样本，补齐品类源头基准。", steam(1530300), steamImage(1530300), "autochess.jpg"],
  ["Mechabellum", "Mechabellum", "自走棋", "机甲战术自走棋", "Game River", "Dreamhaven", "PC/Steam", ["PC"], "2024-09-26", "对标参照池", "以大规模机甲编队和回合部署拓展自走棋的硬核策略边界。", steam(669330), steamImage(669330, "f3f37756ab2d419f107d9656d04a4b5311a108fe/header.jpg"), "mechabellum.jpg"],
  ["The Bazaar", "The Bazaar", "自走棋", "英雄构筑/自动战斗", "Tempo", "Tempo", "PC", ["PC"], "2025-08-13", "主追踪池", "以商店选购和英雄构筑驱动自动战斗，是背包构筑与自走棋融合的重要样本。", steam(1617400), steamImage(1617400, "eac2893cccab684a615561e84831b6d4f7a39410/header.jpg"), "the-bazaar.jpg"],
  ["Once Upon a Galaxy", "Once Upon a Galaxy", "自走棋", "卡牌构筑自走棋", "Million Dreams Games", "Million Dreams Games", "移动/PC", ["iOS", "Android", "PC"], "2025-07-29", "主追踪池", "跨移动与 PC 的轻量卡牌自走棋，是新一代小团队产品样本。", steam(3062740), steamImage(3062740), "once-upon-a-galaxy.jpg"],
  ["Random Dice 2", "Random Dice 2", "策略塔防/卡牌对战", "随机合成/PvP塔防", "111%", "111%", "移动", ["iOS", "Android"], "2026-08-13", "主追踪池", "随机塔防头部系列续作，已从概率抽取转向更强调对局策略的产品验证。", auditSource, "https://play-lh.googleusercontent.com/OLh-9wZI9n7p7YV-AHiBkJsppvbxYr6AdVEFcEzj4-BZWTVxDG9NixUAxisFTO4174LXEOsv-nWhrcS2Bp70PQ=s512-rw", "random-dice-2.jpg"],
  ["PICO PARK 2", "PICO PARK 2", "派对闯关", "多人合作解谜/平台闯关", "TECOPARK / Gemdrops", "TECOPARK", "PC/主机", ["PC", "Nintendo Switch", "Xbox"], "2024-08-27", "主追踪池", "低门槛多人协作解谜代表，关卡要求实时沟通与共同完成。", steam(2644470), steamImage(2644470), "pico-park-2.jpg"],
  ["人类一败涂地", "Human Fall Flat", "派对闯关", "物理沙盒合作解谜", "No Brakes Games", "Curve Games", "移动/PC/主机", ["iOS", "Android", "PC", "PlayStation", "Xbox", "Nintendo Switch"], "2016-07-22", "主追踪池", "物理互动与多人协作的长线常青样本，补齐派对合作品类基础标杆。", steam(477160), steamImage(477160, "9258286b309480a3ce438c07cb51fadf3ea2f1d1/header_alt_assets_27.jpg"), "human-fall-flat.jpg"],
  ["Chained Together", "Chained Together", "派对闯关", "多人协作攀爬", "Anegar Games", "Secret Mode", "PC/Steam", ["PC"], "2024-06-19", "主追踪池", "物理绳链把失误和进度绑定给全队，是强传播的协作闯关机制样本。", steam(2567870), steamImage(2567870, "72749624a8611d50c47383638a21b5f6bb82f8f5/header_alt_assets_0.jpg"), "chained-together.jpg"],
  ["Deceit 2", "Deceit 2", "社交-狼人杀类", "第一人称身份推理/非对称恐怖", "World Makers", "World Makers", "PC/主机", ["PC", "PlayStation", "Xbox"], "2023-09-14", "主追踪池", "隐藏身份、语音博弈与实时逃生结合，是社交推理向动作化演进的核心样本。", steam(2064870), steamImage(2064870, "c7b9c187581f8e968e1e7c0c494cbd856b66ea56/header.jpg"), "deceit-2.jpg"],
  ["The Outlast Trials", "The Outlast Trials", "社交-多人合作类", "多人潜行/合作恐怖", "Red Barrels", "Red Barrels", "PC/主机", ["PC", "PlayStation", "Xbox"], "2024-03-05", "对标参照池", "中重度合作恐怖标杆，用于对照轻量合作产品的协作压力与内容周期。", steam(1304930), steamImage(1304930, "65fbdba4ad0f1a7ed7a362a086c87042fa40fadc/header_alt_assets_3.jpg"), "outlast-trials.jpg"],
  ["mo.co", "mo.co", "社交-多人合作类", "合作狩猎/轻量动作RPG", "Supercell", "Supercell", "移动", ["iOS", "Android"], "2025-03-18", "对标参照池", "Supercell 对移动端短局合作狩猎和赛季服务的验证，是中度化边界参照。", "https://moco.supercell.com/", "https://play-lh.googleusercontent.com/tHxCChFttGA6e_pcPNjScXuKiXEuSGniqVJYfCe0cYtfMz_g8lqjiYmsttSVKFgNSfl7ckemCnDsUTrE9PIR=s512-rw", "moco.jpg"],
];

const pipelineRows = [
  ["Aniimo", "伊莫", "捉宠类", "开放世界捉宠RPG", "Pawprint Studio", "Kingsglory Games", "PC/主机/移动", ["PC", "PlayStation 5", "Xbox Series", "iOS", "Android"], "2026-09-23", "对标参照池", "PC/主机已上线；移动端定档 2026-09-23", "开放世界捉宠重点新品；截至 9 月 20 日仅 PC/主机上线，移动端仍按定档节点跟踪。", "https://www.aniimo.com/main", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/69/84/36/69843695-6c91-5db7-0f69-befd8cd3187a/FPX_AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg", "aniimo.jpg"],
  ["My Time at Evershine", "时光3：永耀之境", "模拟经营类", "城镇经营/生活模拟RPG", "Pathea Games", "Pathea Games", "PC/主机", ["PC", "PlayStation 5", "Xbox Series", "Nintendo Switch 2"], "2027", "主追踪池", "在研 · 计划 2027 年发售", "帕斯亚时光系列新作，从个人工坊经营扩展为城镇治理与多人合作。", steam(3199500), steamImage(3199500), "my-time-at-evershine.jpg"],
];

const released = rows.map((row) => record(row, false));
const pipeline = pipelineRows.map((row) => record(row, true));
const products = [...released, ...pipeline];
const autoChess = released.find((product) => product.name === "多多自走棋");
Object.assign(autoChess, {
  aliases: ["Auto Chess", "Auto Chess:Origin"],
  databrain_query: "Auto Chess:Origin",
});
const aniimo = pipeline.find((product) => product.name === "Aniimo");
Object.assign(aniimo, {
  description: "《伊莫》（Aniimo）是 Pawprint Studio 研发、FunPlus 旗下 Kingsglory Games 发行的开放世界捉宠 RPG。玩家通过“联结”机制与 Aniimo 切换或融合，完成探索、收集、培养与即时战斗。PC/主机已于 9 月 16 日上线，移动端定档 9 月 23 日。",
  profile: {
    ...aniimo.profile,
    gameplay: "开放世界探索、捕捉与培养生物，并通过“联结”机制在角色和 Aniimo 之间切换或融合进行即时战斗。",
    data_source: "官方产品页 / GRP 测试报告 / DataBrain 产品与指标资料",
    source_url: [
      { title: "《伊莫》官方产品页", url: "https://www.aniimo.com/main", type: "官方" },
      { title: "DataBrain 产品与市场资料", url: aliasAuditSource, type: "内部游戏库/公众号" },
      { title: "DataBrain PC 指标", url: aliasMetricsSource, type: "指标" },
      { title: "《伊莫》三测产品分析", url: "https://grp.woa.com/report.html?id=153", type: "GRP 测试报告" },
    ],
  },
  intelligence: {
    media_coverage: 4,
    latest_date: "2026-09-20",
    recent_articles: [
      { title: "《伊莫》PC、主机版正式上线", date: "2026-09-16", source: "《伊莫》官方", summary: "Windows PC、Steam、Epic、PS5 与 Xbox 版本正式上线；移动端仍按 9 月 23 日定档跟踪。", url: "https://www.aniimo.com/", type: "分平台上线" },
      { title: "全球预约与 Steam 愿望单积累", date: "2026-09-20", source: "DataBrain 内部游戏库 / 游戏研究所Pro / 公众号库", summary: "公开资料显示全球预约达到 3000 万量级，Steam 愿望单突破 100 万。", url: aliasAuditSource, type: "市场热度" },
    ],
    resources: [
      { title: "《伊莫》官方产品页", url: "https://www.aniimo.com/main", type: "官方" },
      { title: "DataBrain 产品与市场资料", url: aliasAuditSource, type: "内部游戏库/公众号" },
      { title: "DataBrain PC 指标", url: aliasMetricsSource, type: "指标" },
      { title: "《伊莫》三测产品分析", url: "https://grp.woa.com/report.html?id=153", type: "GRP 测试报告" },
    ],
    status: "产品、发行与市场热度资料已完成多源核验",
  },
  data_coverage: {
    metrics_fields: ["PC 日均 ACU", "PC 峰值 ACU", "PC 日收入"],
    metrics_status: "已接入 2026-09-16 至 2026-09-19 的 PC 日频序列；移动端尚未上线，无移动端运营指标",
    metrics_source: aliasMetricsSource,
    next_source: "移动端上线后继续刷新日频指标",
  },
});

function record(row, isPipeline) {
  const [name, second, category, sub, developer, publisher, platform, platforms, releaseDate, pool, statusOrWhy, whyOrSource, sourceOrIcon, iconOrFile, maybeFile] = row;
  const nameCn = isPipeline ? second : undefined;
  const en = isPipeline ? name : second;
  const status = isPipeline ? statusOrWhy : "活跃";
  const why = isPipeline ? whyOrSource : statusOrWhy;
  const sourceUrl = isPipeline ? sourceOrIcon : whyOrSource;
  const iconUrl = isPipeline ? iconOrFile : sourceOrIcon;
  const iconFile = isPipeline ? maybeFile : iconOrFile;
  return {
    name, ...(nameCn ? { name_cn: nameCn, aliases: unique([nameCn, en]) } : {}), en, name_en: en, track: "休闲互动", category, sub, mode: "多人",
    platform, platforms, year: Number(String(releaseDate).slice(0, 4)), status, release_status: isPipeline ? status : "已上线",
    release_date: releaseDate, developer, publisher, source: "官方商店 / DataBrain 审查", pool, why, description: why,
    traits: ["社交传播属性强", "复玩性强"],
    profile: { developer, publisher, platforms, release_status: isPipeline ? status : "已上线", release_date: releaseDate, data_source: "官方商店 / DataBrain 审查", source_url: [{ title: `${name} 官方资料`, url: sourceUrl, type: "官方/商店" }, { title: "DataBrain 漏项审查", url: auditSource, type: "数据" }] },
    intelligence: { media_coverage: 2, latest_date: "2026-09-20", recent_articles: [{ title: `${name} 生命周期与产品信息核验`, date: "2026-09-20", source: "官方商店 / DataBrain", summary: why, url: sourceUrl, type: isPipeline ? "在研核验" : "产品核验" }], resources: [{ title: `${name} 官方资料`, url: sourceUrl, type: "官方/商店" }, { title: "DataBrain 漏项审查", url: auditSource, type: "数据" }], status: "已按官方商店与 DataBrain 交叉核验" },
    data_coverage: { metrics_fields: [], metrics_status: isPipeline ? "尚未完整上线，等待稳定运营指标" : "已加入 DataBrain 待查询清单", metrics_source: "", next_source: "DataBrain 日频刷新" },
    metrics: {}, lifecycle: { pipeline: isPipeline, stage: isPipeline ? status : "已上线", stage_date: releaseDate, reason: why },
    icon_path: `/game-icons/audit-${iconFile}`, icon_source: iconUrl.includes("steamstatic") ? "steam" : iconUrl.includes("mzstatic") ? "app-store-us" : "google-play",
    _icon_url: iconUrl,
  };
}

function makeAssessment(name, sourceUrl, readiness, summary, strengthTitles, riskTitles, watches) {
  return {
    as_of: "2026-09-20",
    source: { label: "官方产品页 + DataBrain", title: `${name} 生命周期核验`, url: sourceUrl, report_date: "2026-09-20", scope: "产品定位、平台与发行状态" },
    verdict: { stance: "继续观察", potential: "中高", readiness, confidence: "高", summary },
    strengths: strengthTitles.map(([title, judgement]) => ({ module: "产品定位", title, judgement, status: "官方资料", evidence_refs: ["官方产品页"] })),
    risks: riskTitles.map(([title, judgement]) => ({ module: "发行验证", title, judgement, status: "待验证", evidence_refs: ["当前公开版本"] })),
    changes_since_last_test: [{ module: "生命周期", direction: "阶段推进", title: readiness, detail: summary }],
    next_watch: watches.map(([question, trigger]) => ({ module: "后续观察", question, trigger })),
  };
}

const aniimoAssessment = makeAssessment(
  "Aniimo / 伊莫",
  aliasAuditSource,
  "PC/主机已上线 · 移动端 9 月 23 日",
  "开放世界捉宠与“联结”机制具备明确差异化，PC/主机首发后已形成首轮运营信号；移动端 9 月 23 日上线后，需要继续观察跨平台规模、留存和口碑能否延续预约势能。",
  [
    ["“联结”把生物能力直接带入探索与战斗", "玩家可切换或融合伊莫形态，不同生物能力同时服务移动、解谜和即时战斗，使捕捉对象不只是队伍数值。"],
    ["携宠开放世界已形成清晰内容框架", "主城、野外生态、稀有变体、栖息地以及水生和飞行系伊莫共同支撑探索与收集目标。"],
    ["预约与 Steam 愿望单形成前期势能", "公开资料显示全球预约达到 3000 万量级，Steam 愿望单突破 100 万。"],
    ["PC 与主机首发形成正式版验证样本", "9 月 16 日首发覆盖 PC、Steam、Epic、PS5 与 Xbox，并已提供跨平台数据互通信息和可复核的长流程实机。"],
  ],
  [
    ["移动端晚于首批平台上线", "不能把首批平台上线等同于全平台完成发行。"],
    ["长草期出现较早，开放世界供给压力明确", "三轮测试持续暴露内容消耗快的问题；正式版需要用地图探索、养成目标和版本节奏承接首月留存。"],
    ["合作内容存在，但共同目标感偏弱", "二测加入双人解密和合作战斗，三测又弱化强制社交；多人体验能否形成稳定协作循环仍需验证。"],
    ["战斗手感和性能优化仍影响完成度", "首测、二测均记录动作反馈和性能问题；DLSS 4.5 等技术支持不能替代跨设备帧率、卡顿和操控体验验证。"],
    ["稀缺宠捕捉成本可能放大养成压力", "三测调整外观付费和终局出口，同时提高稀缺宠物捕捉成本；正式运营中的获取节奏和付费接受度仍需观察。"],
  ],
  [
    ["移动端是否按期上线？", "9 月 23 日商店状态与首周 DAU"],
    ["内容能否支撑首月留存？", "版本节奏、活跃与口碑变化"],
    ["跨平台互通能否转化为稳定的合作关系和共同目标？", "组队率、合作玩法参与率与跨平台社交反馈"],
    ["稀缺宠物捕捉成本与外观付费是否获得玩家接受？", "首月付费结构、捕捉反馈与商店口碑"],
  ],
);
Object.assign(aniimoAssessment.source, {
  label: "GRP 报告 #153",
  title: "《伊莫》三测产品分析",
  url: "https://grp.woa.com/report.html?id=153",
  report_date: "2026-07-10",
  scope: "上线前删档付费测试、商业化、终局调整与长线风险",
  author: "辛昱毅 (yuliaxin)",
});
aniimoAssessment.strengths[1].status = "多源核验";
aniimoAssessment.strengths[0].module = "核心机制";
aniimoAssessment.strengths[0].status = "三轮测试确认";
aniimoAssessment.strengths[0].evidence_refs = ["GRP #64 / #63 / #153"];
aniimoAssessment.strengths[1].module = "世界与收集";
aniimoAssessment.strengths[1].status = "多源核验";
aniimoAssessment.strengths[1].evidence_refs = ["GRP #63 / #153", "DataBrain 产品资料"];
aniimoAssessment.strengths[2].module = "市场热度";
aniimoAssessment.strengths[2].status = "多源核验";
aniimoAssessment.strengths[2].evidence_refs = ["4Gamers", "游戏研究所 Pro / 公众号库"];
aniimoAssessment.strengths[3].module = "跨平台发行";
aniimoAssessment.strengths[3].status = "正式版已验证";
aniimoAssessment.strengths[3].evidence_refs = ["Aniimo 官方", "IT之家 / 凤凰网科技"];
aniimoAssessment.risks[1].module = "内容消耗";
aniimoAssessment.risks[1].status = "多轮报告确认";
aniimoAssessment.risks[1].evidence_refs = ["GRP #64 / #63 / #153"];
aniimoAssessment.risks[2].module = "多人体验";
aniimoAssessment.risks[2].status = "测试报告确认";
aniimoAssessment.risks[2].evidence_refs = ["GRP #63 / #153"];
aniimoAssessment.risks[3].module = "动作与性能";
aniimoAssessment.risks[3].status = "待正式版持续验证";
aniimoAssessment.risks[3].evidence_refs = ["GRP #64 / #63", "DataBrain 产品资料"];
aniimoAssessment.risks[4].module = "商业化";
aniimoAssessment.risks[4].status = "三测报告确认";
aniimoAssessment.risks[4].evidence_refs = ["GRP #153"];
aniimoAssessment.changes_since_last_test = [
  { module: "首测版本", direction: "核心循环成型", title: "以“联结”串联捕捉、探索与战斗", detail: "首测确立不依赖 SOC 的携宠大世界路线，并用主城与双人内容验证轻社交方向。" },
  { module: "二测版本", direction: "内容扩展", title: "主城、双人解密与合作战斗扩大体验边界", detail: "二测补充宠物商业化链条和多人内容，同时继续暴露内容消耗、动作体验与性能问题。" },
  { module: "三测版本", direction: "商业化验证", title: "上线前删档付费测试", detail: "三测加入外观付费体系，降低前期负担并调整终局出口，同时提高稀缺宠物捕捉成本、弱化强制社交。" },
  { module: "生命周期", direction: "阶段推进", title: "PC/主机已上线 · 移动端 9 月 23 日", detail: "PC/主机于 9 月 16 日上线并形成首轮日频数据；正式版进一步优化水生与飞行系伊莫并支持 DLSS 4.5，移动端仍按 9 月 23 日定档跟踪。" },
];

const pipelineDetails = {
  Aniimo: {
    category: "捉宠类", gameplay: "开放世界探索、捕捉与培养生物、队伍构筑和即时战斗。",
    release_status: "PC/主机已上线；移动端定档 2026-09-23", platforms: "PC / PS5 / Xbox Series / iOS / Android",
    stage: "PC/主机已上线 · 移动端上线定档", stage_date: "2026-09-23", confidence: "高",
    analysis: { core_loop: "开放世界探索、捕捉养成，并通过“联结”机制在角色和 Aniimo 之间切换或融合进行即时战斗。", social: "跨平台社交深度待移动端上线后验证。", differentiation: "“联结”机制让玩家直接切换或融合 Aniimo，形成探索、收集与战斗的一体化体验。", readiness: "PC/主机已上线并已有 DataBrain 日频指标；移动端尚未上线。" },
    gameplay_videos: [
      { date: "2026-06-17", milestone_date: "2026-07-10", source: "Aniimo 官方", platform: "YouTube", type: "官方玩法展示", title: "Aniimo | Gameplay Showcase", summary: "官方集中展示开放世界探索、生物捕捉、联结切换与即时战斗，是三测前最完整的玩法影像之一。", url: "https://www.youtube.com/watch?v=XHPS09hP7m4" },
      { date: "2026-09-20", milestone_date: "2026-09-16", source: "Rubhen925", platform: "YouTube", type: "正式版完整实机（5:44:50）", title: "Aniimo - Full Game Gameplay Walkthrough", summary: "PS5 Pro 性能模式无解说长流程，覆盖正式版主线、探索、捕捉与战斗，可用于核对首发版本的实际完成度。", url: "https://www.youtube.com/watch?v=6HRiu1seQzo" },
    ],
    media_reports: [
      { date: "2026-09-14", source: "IT之家", kind: "发行与产品资料", title: "《伊莫》PC 预载、公测与跨平台信息", summary: "报道汇总 PC 预载与公测安排、Pawprint Studio 与 FunPlus 的研发发行关系、跨平台互通及“联结”核心机制。", url: "https://www.ithome.com/0/859/557.htm" },
      { date: "2026-09-11", source: "4Gamers", kind: "市场与发行报道", title: "全球预约突破 3000 万，PC 与主机版 9 月 16 日上线", summary: "报道确认全球预约突破 3000 万、Steam 愿望单突破 100 万，并整理联结机制、正式版优化和分平台发行安排。", url: "https://www.4gamers.com.tw/news/detail/81992/imo-global-pre-registration-30-million-pc-console-launch" },
      { date: "2026-08-26", source: "凤凰网科技", kind: "科隆展与定档报道", title: "国产捉宠 RPG《伊莫》定档 9 月 16 日首发", summary: "科隆展节点确认 PC/主机首发日期、跨平台数据互通及 2800 万预约规模。", url: "https://tech.ifeng.com/c/8vuI3zvfrNH" },
    ],
    testing: { status: "PC/主机运营中 · 移动端待上线", latest: "2026-09-16 PC/主机上线", platforms: "PC / PS5 / Xbox / iOS / Android", test_type: "分平台发行", scope: "上线状态与跨平台运营", sourceUrl: "https://www.aniimo.com/main", sourceLabel: "Aniimo 官方", records: [{ date: "2026-09-16", type: "PC/主机上线", title: "PC 与主机端正式上线", lifecycle_phase: "launch", summary: "Windows PC、Steam、Epic、PS5 与 Xbox 版本进入正式运营。", source: "《伊莫》官方", url: "https://www.aniimo.com/" }, { date: "2026-09-23", type: "移动端上线", title: "iOS / Android 上线定档", lifecycle_phase: "launch", status: "planned", summary: "截至 9 月 20 日仍为未来节点。", source: "App Store", url: "https://apps.apple.com/us/app/aniimo/id6759098797" }] },
    source_url: "https://www.aniimo.com/main",
    assessment: aniimoAssessment,
  },
  "My Time at Evershine": {
    category: "模拟经营类", gameplay: "探索采集、城镇建设、居民招募、任务与关系经营。",
    release_status: "在研 · Steam 标注 2027", platforms: "PC / PS5 / Xbox Series / Nintendo Switch 2",
    stage: "开发与众筹更新阶段 · 计划 2027 年发售", stage_date: "2027", updated_at: "2026-09-20", confidence: "高",
    analysis: { core_loop: "城镇建设、居民招募、关系经营和探索采集。", social: "多人合作规则仍待公开。", differentiation: "从工坊主扩展到城镇管理者视角。", readiness: "正式发售计划为 2027 年，确切日期未公布。" },
    media_reports: [{ date: "2026-09-20", source: "Steam / Pathea", kind: "研发状态", title: "Steam 页面标注 2027 年发售", summary: "仍在开发阶段，未公布确切日月。", url: steam(3199500) }],
    testing: { status: "持续开发 · 发售日待定", latest: "2026-09-20 官方页面核验", platforms: "PC / PS5 / Xbox Series / Nintendo Switch 2", test_type: "开发中", scope: "城镇治理、关系与多人合作", sourceUrl: steam(3199500), sourceLabel: "Steam / Pathea", records: [{ date: "2024-09-17", type: "首次公开", title: "My Time at Evershine 正式公布", lifecycle_phase: "project", summary: "帕斯亚公布时光系列新作与城镇治理方向。", source: "Pathea 官方", url: "https://pathea.net/evershine/" }] },
    source_url: steam(3199500),
    assessment: makeAssessment("My Time at Evershine", steam(3199500), "开发中 · 计划 2027 年发售", "帕斯亚在成熟的时光系列基础上扩大城镇治理、角色关系和多人合作范围；但系统规模与多人闭环尚未经过公开长时版本验证。", [["继承时光系列研发经验", "开发商已有同类产品的完整研发和运营经验。"], ["从个人工坊扩展到聚落治理", "城镇建设和居民招募提供更大的长期目标。"]], [["多人合作扩大制作规模", "多系统并行提高内容、联机和 QA 压力。"], ["缺少接近发行版本的公开体验", "当前无法判断最终完成度。"]], [["何时开放可复现测试？", "Demo、Playtest 或媒体长时试玩"], ["多人是否共享城镇目标？", "多人规则、人数与跨平台说明"]]),
  },
};

const files = Object.fromEntries(await Promise.all(["games.json", "dashboard_data.json", "game-intake.json", "game-icons.json", "pipeline-icons.json", "weekly_scan.json"].map(async (name) => [name, JSON.parse(await fs.readFile(path.join(publicDir, name), "utf8"))])));
const games = files["games.json"];
const dashboard = files["dashboard_data.json"];
const intake = files["game-intake.json"];
const icons = files["game-icons.json"];
const pipelineIcons = files["pipeline-icons.json"];

for (const product of products) {
  const iconUrl = product._icon_url;
  delete product._icon_url;
  await download(iconUrl, path.join(publicDir, product.icon_path));
  upsert(games.games, product);
  upsert(dashboard.games, structuredClone(product));
  upsert(icons, { game: product.name, path: product.icon_path, source: product.icon_source, match: product.name, score: 1 }, "game");
  intake[product.name] = { added_on: "2026-09-20", summary: `审查补录 · ${product.why}` };
  if (product.lifecycle.pipeline) {
    pipelineIcons[product.name] = {
      path: product.icon_path,
      imageUrl: iconUrl,
      pageUrl: product.profile.source_url[0].url,
      title: product.name,
      source: product.icon_source,
    };
  }
}

Object.assign(dashboard.pipelineDetails, pipelineDetails);
syncGrpReports(games, dashboard, JSON.parse(await fs.readFile(path.join(publicDir, "grp_reports.json"), "utf8")));
const other = dashboard.pipelineGroups.find((group) => group.name === "其他厂商在研新品");
other.projects = unique([...other.projects, "Aniimo"]).filter((name) => name !== "My Time at Evershine");
let patheaGroup = dashboard.pipelineGroups.find((group) => group.name === "Pathea Games");
if (!patheaGroup) {
  patheaGroup = { name: "Pathea Games", track_focus: "My Time 系列续作与多人生活模拟方向", projects: [] };
  dashboard.pipelineGroups.push(patheaGroup);
}
patheaGroup.projects = unique([...patheaGroup.projects, "My Time at Evershine"]);
const pathea = dashboard.domesticStudios.find((studio) => studio.name === "Pathea Games");
if (pathea) {
  pathea.track_focus = "My Time 系列续作与多人生活模拟方向";
  pathea.pool_games = unique([...(pathea.pool_games || []), "My Time at Evershine"]);
  pathea.known_pipeline = unique([...(pathea.known_pipeline || []), "My Time at Evershine（模拟经营·计划2027年）"]);
}
for (const studio of [...dashboard.domesticStudios, ...Object.values(dashboard.overseasStudios || {})]) {
  if (studio.name === "Supercell") studio.known_published = unique([...(studio.known_published || []), "mo.co"]);
  if (/111%/.test(studio.name)) studio.known_published = unique([...(studio.known_published || []), "Random Dice 2"]);
}

const releases = {
  "塔塔冒险队": ["2026-09-04", "已上线 · 移动端正式公测"],
  "王者万象棋": ["2026-09-10", "已上线 · 全平台正式公测"],
  "小冰冰斗蛐蛐": ["2026-09-10", "已上线 · 不删档版本"],
};
for (const [name, [date, status]] of Object.entries(releases)) {
  for (const collection of [games.games, dashboard.games]) {
    const game = collection.find((item) => item.name === name);
    if (game) Object.assign(game, { status, release_status: status, release_date: date, lifecycle: { ...(game.lifecycle || {}), pipeline: false, stage: status, stage_date: date } });
  }
}

games.meta = { ...games.meta, version: "v3.1", updated: "2026-09-20", icon_coverage: games.games.filter((game) => game.icon_path).length, icon_updated_at: new Date().toISOString(), audit: { date: "2026-09-20", added: products.map((product) => product.name), source: auditSource, note: "按九类品类、重点厂商与官方商店交叉审查；别名不计为独立产品。" } };
dashboard.pipelineMeta.project_count = dashboard.pipelineGroups.filter((group) => group.name !== "试玩验证样本").flatMap((group) => group.projects).length;
dashboard.pipelineMeta.structured_assessment_count = Object.values(dashboard.pipelineDetails).filter((detail) => detail.assessment).length;
dashboard.pipelineMeta.source_reviewed_at = "2026-09-20";
files["weekly_scan.json"].meta.current_pool_size = games.games.length;
files["weekly_scan.json"].meta.audit_date = "2026-09-20";
files["weekly_scan.json"].meta.audit_added = products.length;

await Promise.all(Object.entries(files).map(([name, value]) => fs.writeFile(path.join(publicDir, name), `${JSON.stringify(value, null, 2)}\n`)));
console.log(JSON.stringify({ added: products.length, total: games.games.length, pipeline: dashboard.pipelineMeta.project_count }, null, 2));

function upsert(list, record, key = "name") {
  const current = list.find((item) => item[key] === record[key]);
  if (current) Object.assign(current, record); else list.push(record);
}

function unique(items) {
  return [...new Set(items)];
}

async function download(url, destination) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CasualRadar/1.0" } });
  if (!response.ok) throw new Error(`Icon download failed (${response.status}): ${url}`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
