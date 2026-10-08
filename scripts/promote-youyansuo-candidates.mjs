import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productResearch } from "./youyansuo-product-research.mjs";
import { discoveryExclusionReason } from "./normalize-youyansuo-discovery.mjs";
import { synchronizeDiscoveredStudioProducts } from "./studio-association-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const read = (name) => JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8"));
const write = (name, value) => fs.writeFileSync(path.join(publicRoot, name), `${JSON.stringify(value, null, 2)}\n`);
const discovery = read("youyansuo_discovery.json");
const candidateRows = discovery.candidates.filter((row) => row.scope_status !== "out_of_scope" && !discoveryExclusionReason(row.name));

const categoryMap = {
  "模拟经营": { label: "模拟经营类", track: "休闲互动", group: "游研所新增在研新品" },
  "自走棋": { label: "自走棋", track: "策略互动", group: "游研所新增在研新品" },
  "捉宠": { label: "捉宠类", track: "休闲互动", group: "游研所新增在研新品" },
  "多人合作": { label: "社交-多人合作类", track: "休闲互动", group: "游研所新增在研新品" },
};
const overrides = {
  "奇遇动物城": { publisher: "莉莉丝游戏", developer: "猫爪拿铁工作室", platforms: ["移动端", "PC"], stage: "首支PV与实机公开 · 预约中", pipeline: true, summary: "生活模拟新游，公开动物都市、家园建造、多职业和多人联机设计。" },
  "Dressmaker": { aliases: ["Dressmaker", "针影裁梦"], platforms: ["PC/Steam"], stage: "Steam 上线验证 · 文章报道", pipeline: false, summary: "裁缝模拟产品，围绕选布、打版、裁剪和缝纫进行自由创作。" },
  "蓝色星原：旅谣": { platforms: ["App手游"], stage: "三测产品验证", pipeline: true, summary: "捉宠大世界产品，近期三测调整捕捉、探索、对战和减负系统。" },
  "火人冲冲冲": { publisher: "凉屋游戏", platforms: ["App手游"], stage: "轻竞技自走棋 · 状态待核验", pipeline: true, summary: "竖屏自走棋，以自动战斗、共享卡池、金币和升星构成对局选择。" },
  "时之铃": { platforms: ["App手游"], stage: "内部测试 · 计划11至12月内测", pipeline: true, summary: "二次元自走棋，采用词条联动构筑，并以PVE探索反哺PVP。" },
  "源初之结": { publisher: "米哈游", platforms: ["PC首发"], stage: "首曝 · PC首发规划", pipeline: true, summary: "多人合作神话动作游戏，强调低门槛、不强制组队和游玩解锁角色。" },
  "未眠野": { platforms: ["多端"], stage: "试玩阶段 · 双人合作验证", pipeline: true, summary: "开放世界探索与战斗产品，试玩内容包含双人关卡和多人合作能力交互。" },
};
const icons = {
  "火人冲冲冲": { path: "/game-icons/youyansuo-fire-pending.svg", source: "文字占位；尚无可核验的官方图标", pageUrl: "", imageUrl: "" },
  "奇遇动物城": { path: "/game-icons/youyansuo-animal-city.png", source: "TapTap 官方预约页 · app/904033", pageUrl: "https://www.taptap.cn/app/904033", imageUrl: "https://img-tc.tapimg.com/market/images/00b885d1b42bde51993b280af01896c2.png/_tap_appicon.jpg" },
  "未眠野": { path: "/game-icons/youyansuo-unawake.png", source: "TapTap 官方预约页 · app/894924", pageUrl: "https://www.taptap.cn/app/894924", imageUrl: "https://img-tc.tapimg.com/market/images/b67034b64568bf3ba4ea4ca7e0d22bea.jpg/_tap_appicon.jpg" },
  "Dressmaker": { path: "/game-icons/youyansuo-dressmaker.png", source: "TapTap 针影裁梦详情页 · app/935712", pageUrl: "https://www.taptap.cn/app/935712", imageUrl: "https://img-tc.tapimg.com/market/images/32ca15461a120e8949b43fbb4708e36b.png/_tap_appicon.jpg" },
  "源初之结": { path: "/game-icons/youyansuo-nodusfall.png", source: "TapTap 官方预约页 · app/917670", pageUrl: "https://www.taptap.cn/app/917670", imageUrl: "https://img-tc.tapimg.com/market/images/1323b10a19f0c8b3297aac71b95a6860.png/_tap_appicon.jpg" },
  "时之铃": { path: "/game-icons/youyansuo-bell-of-time.png", source: "TapTap 官方预约页 · app/481530", pageUrl: "https://www.taptap.cn/app/481530", imageUrl: "https://img-tc.tapimg.com/market/images/4e67bc04cc71c662ede65e37080f9a67.png/_tap_appicon.jpg" },
  "蓝色星原：旅谣": { path: "/game-icons/youyansuo-azur-promilia.png", source: "TapTap 官方预约页 · app/593829", pageUrl: "https://www.taptap.cn/app/593829", imageUrl: "https://img-tc.tapimg.com/market/images/1872d1c47c508dd2d6f5059d2d51cac4.png/_tap_appicon.jpg" },
};

function categoryFor(row) {
  const category = Array.isArray(row.category) ? row.category.find((value) => categoryMap[value]) : row.category;
  return categoryMap[category] || { label: "其他类", track: "新品发现", group: "游研所新增在研新品" };
}

function sourceList(row, research) {
  return [
    ...(research.official ? [{ title: research.official.title, url: research.official.url, type: "官方商店" }] : []),
    { title: `游研所文章：${row.evidence_title}`, url: row.source_url, type: "公众号原文" },
    ...(research.extraReports || []).map((report) => ({ title: report.title, url: report.url, type: report.type || "媒体报道" })),
    { title: "游研所 MCP 服务", url: "https://ai.xianjianwendao.com/kb/mcp/mcp", type: "MCP 数据源" },
  ];
}

function productFromRow(row) {
  const override = overrides[row.name] || {};
  const research = productResearch[row.name];
  const icon = icons[row.name];
  if (!icon) throw new Error(`缺少 ${row.name} 的图标核验记录`);
  if (!research) throw new Error(`缺少 ${row.name} 的产品情报核验记录`);
  const taxonomy = categoryFor(row);
  const pipeline = override.pipeline !== false;
  const aliases = [...new Set([row.name, ...(override.aliases || [])])];
  const sources = sourceList(row, research);
  const reports = [
    { title: row.evidence_title, source: "游研所收录公众号", date: row.published_date, summary: research.reportSummary || row.summary, url: row.source_url, type: "公众号报道" },
    ...(research.extraReports || []).map((report) => ({ title: report.title, source: report.source, date: report.date, summary: report.summary, url: report.url, type: report.type || "媒体报道" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = reports[0].date;
  const teamReportUrl = new URL(row.source_url);
  if (teamReportUrl.hostname === "mp.weixin.qq.com") teamReportUrl.protocol = "https:";
  const developmentProfile = !pipeline ? {
    company: research.developer || "未公开",
    team: research.team.studio,
    team_note: research.team.note,
    early_team_size: research.team.size,
    producer: "未公开",
    development_cycle: research.team.developmentCycle,
    prior_experience: "未公开；待补充可核验的同团队履历",
    confidence: "官方主体与媒体团队口径",
    coverage_level: "深度档案",
    sources: [
      ...research.team.sources.map((source) => ({ label: source.label, url: source.url, note: source.scope })),
      { label: "游研所收录公众号", url: teamReportUrl.href, note: "团队规模与原型经历为媒体报道口径，非官方人数" },
    ],
  } : undefined;
  return {
    name: row.name,
    name_cn: row.name,
    aliases,
    en: row.name,
    name_en: row.name,
    track: taxonomy.track,
    category: taxonomy.label,
    sub: (Array.isArray(row.category) ? row.category : []).join(" / ") || "新品发现",
    mode: taxonomy.label === "社交-多人合作类" ? "多人" : "单人或多人",
    platform: research.platforms.join("/"),
    platforms: research.platforms,
    year: 2026,
    status: pipeline ? "持续跟踪" : "已上线 / 边界观察",
    release_status: research.releaseStatus,
    release_date: research.releaseDate || "TBA",
    developer: research.developer || "待核验",
    publisher: research.publisher || "待核验",
    source: research.official ? "官方商店 / 游研所 MCP / 公众号原文" : "游研所 MCP / 公众号原文",
    pool: pipeline ? "主追踪池" : "边界观察池",
    why: `游研所新品发现：${research.summary}`,
    description: research.summary,
    traits: Array.isArray(row.category) ? row.category : [],
    profile: {
      developer: research.developer || "待核验",
      publisher: research.publisher || "待核验",
      platforms: research.platforms,
      release_status: research.releaseStatus,
      release_date: research.releaseDate || "TBA",
      data_source: "官方商店与游研所 MCP 文章核验",
      gameplay: research.analysis.core_loop,
      source_url: sources,
    },
    ...(developmentProfile ? { development_profile: developmentProfile } : {}),
    intelligence: {
      media_coverage: reports.filter((report) => report.type !== "官方更新").length,
      latest_date: latestDate,
      recent_articles: reports,
      resources: sources,
      status: "产品与进展信息已按公开信源核验；暂无 DataBrain 日频量化覆盖。",
    },
    data_coverage: {
      metrics_fields: [],
      metrics_status: "尚未接入 DataBrain",
      metrics_source: "",
      next_source: "DataBrain / SteamDB / 官方商店（按平台匹配）",
    },
    metrics: {},
    lifecycle: {
      pipeline,
      stage: research.stage,
      stage_date: research.stageDate || null,
      reason: "仅明确写出发生日期的官方披露、测试或发售进入事件时间线；其余文章按报道日期归档。",
    },
    icon_path: icon.path,
    icon_source: icon.source,
  };
}

const gamesDocument = read("games.json");
const dashboard = read("dashboard_data.json");
const intake = read("game-intake.json");
const pipelineIcons = read("pipeline-icons.json");
const products = candidateRows.map(productFromRow);
for (const product of products) {
  const upsert = (items) => {
    const index = items.findIndex((item) => item.name === product.name);
    if (index === -1) items.push(product);
    else items[index] = { ...items[index], ...product };
  };
  upsert(gamesDocument.games);
  upsert(dashboard.games);
  intake[product.name] = {
    added_on: discovery.meta.scan_date,
    summary: `游研所新品发现已确认纳入看板：${product.description}`,
  };
  pipelineIcons[product.name] = {
    path: product.icon_path,
    ...(icons[product.name].imageUrl ? { imageUrl: icons[product.name].imageUrl } : {}),
    pageUrl: icons[product.name].pageUrl || product.profile.source_url[0].url,
    title: product.name,
    source: icons[product.name].imageUrl ? "taptap" : "editorial-placeholder",
  };
  if (product.lifecycle.pipeline) {
    const taxonomy = categoryFor(discovery.candidates.find((row) => row.name === product.name));
    const row = discovery.candidates.find((entry) => entry.name === product.name);
    const research = productResearch[product.name];
    const evidenceLabel = research.official?.title || "游研所收录公众号";
    const assessmentItems = (items, status) => items.map(([module, title, judgement]) => ({ module, title, judgement, status, evidence_refs: [evidenceLabel, row.evidence_title] }));
    const detail = {
      stage: product.lifecycle.stage,
      stage_date: research.stageDate || null,
      evidence_date: product.intelligence.latest_date,
      platforms: product.platforms.join(" / "),
      confidence: "中",
      category: product.category,
      developer: product.developer,
      release_status: product.release_status,
      analysis: research.analysis,
      team: research.team,
      assessment: {
        as_of: discovery.meta.scan_date > product.intelligence.latest_date ? discovery.meta.scan_date : product.intelligence.latest_date,
        source: { label: "游研所收录公众号", title: row.evidence_title, report_date: row.published_date, scope: "玩法、团队与项目进展", url: row.source_url },
        verdict: { stance: "继续观察", potential: "待判断", readiness: product.lifecycle.stage, confidence: "中", summary: research.verdict },
        strengths: assessmentItems(research.strengths, "公开证据"),
        risks: assessmentItems(research.risks, "待验证"),
        changes_since_last_test: [{ module: "本轮补充", direction: "证据更新", title: "产品情报补齐", detail: research.change }],
        next_watch: research.nextWatch.map(([module, question, trigger]) => ({ module, question, trigger })),
      },
      media_reports: [
        { date: row.published_date, source: "游研所收录公众号", kind: "公众号报道", title: row.evidence_title, summary: research.reportSummary || row.summary, url: row.source_url, timeline: research.timelineReport === true, timeline_date_basis: research.timelineReport ? "report_date" : undefined, date_meaning: "报道日期" },
        ...(research.extraReports || []).map((report) => ({ ...report, kind: "公众号报道", date_meaning: "报道日期" })),
      ],
      testing: { status: research.stage, records: (research.milestones || []).map((record) => ({ ...record, url: record.url || row.source_url })) },
      source_url: product.profile.source_url,
      updated_at: product.intelligence.latest_date,
    };
    dashboard.pipelineDetails[product.name] = detail;
    let group = dashboard.pipelineGroups.find((entry) => entry.name === taxonomy.group);
    if (!group) { group = { name: taxonomy.group, track_focus: "游研所确认的重点品类新品，待官方测试和上线证据补齐", projects: [] }; dashboard.pipelineGroups.push(group); }
    if (!group.projects.includes(product.name)) group.projects.push(product.name);
  }
}

synchronizeDiscoveredStudioProducts(dashboard, gamesDocument);
gamesDocument.meta = { ...gamesDocument.meta, total_games: gamesDocument.games.length, youyansuo_promoted: products.map((product) => product.name) };
dashboard.pipelineMeta = { ...(dashboard.pipelineMeta || {}), project_count: dashboard.pipelineGroups.filter((group) => group.name !== "试玩验证样本").flatMap((group) => group.projects).length, structured_assessment_count: Object.keys(dashboard.pipelineDetails).length };
write("games.json", gamesDocument);
write("dashboard_data.json", dashboard);
write("game-intake.json", intake);
write("pipeline-icons.json", pipelineIcons);
console.log(JSON.stringify({ promoted: products.map((product) => product.name), pipeline: products.filter((product) => product.lifecycle.pipeline).map((product) => product.name), released_observation: products.filter((product) => !product.lifecycle.pipeline).map((product) => product.name) }, null, 2));
