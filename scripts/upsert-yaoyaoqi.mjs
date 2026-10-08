import fs from "node:fs";
import path from "node:path";
import { syncGrpReports } from "./grp-report-lib.mjs";

const root = path.resolve(import.meta.dirname, "..");
const gamesPath = path.join(root, "public", "games.json");
const dashboardPath = path.join(root, "public", "dashboard_data.json");
const officialPage = "https://www.taptap.cn/app/756756";
const officialNews = "https://www.taptap.cn/app/756756/topic?type=official";
const aliasAuditSource = "https://databrain.woa.com/v2/agent/chat?sessionId=skill_52c4e55bbdba411b";

const games = JSON.parse(fs.readFileSync(gamesPath, "utf8"));
const dashboard = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));

const product = {
  name: "妖妖棋",
  name_en: "Yaoyao Chess",
  en: "Yaoyao Chess",
  aliases: ["代号：妖鬼"],
  developer: "杭州网易雷火科技有限公司",
  publisher: "网易游戏",
  platform: "移动",
  platforms: ["iOS", "Android"],
  release_date: "未公布",
  release_status: "预约中（已获版号，公测日期未公布）",
  year: 2026,
  mode: "8 人策略对战（自走棋）",
  source: "TapTap 官方",
  pool: "主追踪池",
  category: "自走棋",
  sub: "中式妖鬼题材大战场自走棋",
  track: "策略互动",
  status: "在研",
  traits: ["阵容构筑", "自动战斗", "多人对抗", "东方志怪题材"],
  why: "网易雷火研发的中式妖鬼题材自走棋，以八人对局、无界大战场和多势力部从构筑作为差异化方向。",
  description: "《妖妖棋》（原《代号：妖鬼》）融合东方志怪题材与自走棋规则。八名玩家从妖界、龙宫、仙庭、幽都等势力招募部从，通过三连、幻神神通和阵容联动扩张战力，在无界大战场中逐轮对抗。",
  profile: {
    developer: "杭州网易雷火科技有限公司",
    publisher: "网易游戏",
    platforms: ["iOS", "Android"],
    release_status: "预约中（已获版号）",
    release_date: "未公布",
    license_isbn: "978-7-498-16357-8",
    license_approval_date: "2026-01-26",
    data_source: "TapTap 官方 / 国家新闻出版署 / GRP 测试报告 / DataBrain",
    gameplay: "8 人同场自走棋；围绕势力选择、部从招募、三连合成、幻神神通和阵容联动构筑队伍，在无界大战场中自动作战并逐步淘汰对手。",
    source_url: [
      { title: "《妖妖棋》官方预约页", url: officialPage, type: "官方" },
      { title: "《妖妖棋》官方公告", url: officialNews, type: "官方" },
      { title: "DataBrain 产品资料", url: aliasAuditSource, type: "内部资料" },
      { title: "网易《代号：妖鬼》二测分析", url: "https://grp.woa.com/report.html?id=74", type: "GRP 测试报告" },
    ],
    en: "Yaoyao Chess",
  },
  social_attr: true,
  data_coverage: {
    metrics_fields: [],
    metrics_status: "尚未正式上线，暂无稳定运营指标",
    metrics_source: "",
    next_source: "正式上线后接入 DataBrain 移动端指标",
  },
  metrics: {},
  intelligence: {
    media_coverage: 3,
    latest_date: "2026-02-12",
    recent_articles: [
      {
        title: "《妖妖棋》新年喜获版号",
        source: "TapTap 官方",
        date: "2026-02-12",
        summary: "官方确认《代号：妖鬼》正式更名为《妖妖棋》并取得版号；目前继续开放预约，公测日期尚未公布。",
        url: officialNews,
        type: "官方审批/更名",
      },
      {
        title: "网易《代号：妖鬼》二测分析",
        source: "GRP",
        date: "2025-12-25",
        summary: "二测报告确认产品以中式美术、类全战自动战斗和战场布局形成大兵团差异化，同时指出与酒馆战棋相似度较高、后期战斗指引不足。",
        url: "https://grp.woa.com/report.html?id=74",
        type: "测试研究",
      },
      {
        title: "“奇谭论道”第二次玩法技术测试结束",
        source: "TapTap 官方",
        date: "2026-01-04",
        summary: "为期 16 天的安卓限量、不计费、删档测试结束，官方表示将继续优化版本。",
        url: officialNews,
        type: "测试结束",
      },
      {
        title: "“奇谭论道”测试正式开启",
        source: "TapTap 官方",
        date: "2025-12-19",
        summary: "第二次玩法技术测试开启，验证八人大战场、六大势力、部从构筑与幻神系统。",
        url: officialNews,
        type: "测试开启",
      },
    ],
    resources: [
      { title: "《妖妖棋》官方预约页", url: officialPage, type: "官方" },
      { title: "《妖妖棋》官方公告", url: officialNews, type: "官方" },
      { title: "DataBrain 产品资料", url: aliasAuditSource, type: "内部资料" },
      { title: "网易《代号：妖鬼》二测分析", url: "https://grp.woa.com/report.html?id=74", type: "GRP 测试报告" },
    ],
    status: "产品测试、版号与预约状态已有官方公告和 GRP 二测报告交叉验证",
  },
  lifecycle: {
    pipeline: true,
    stage: "已获版号·预约中",
    stage_date: "2026-02-12",
    reason: "已完成第二次玩法技术测试并取得版号，尚未公布公测或正式上线日期。",
  },
  icon_path: "/game-icons/taptap-756756.png",
  icon_source: "taptap",
};

const existingIndex = games.games.findIndex((item) => item.name === product.name);
if (existingIndex >= 0) games.games[existingIndex] = { ...games.games[existingIndex], ...product };
else games.games.push(product);
games.meta.total_games = games.games.length;

const domesticNetEase = games.meta?.studio_tracking?.domestic_majors?.studios?.find((studio) => studio.name === "网易");
if (domesticNetEase) {
  domesticNetEase.track_focus = "生活模拟、社交派对、轻量合作竞技与中式自走棋方向新游";
  domesticNetEase.known_pipeline = [...new Set([...(domesticNetEase.known_pipeline || []), "妖妖棋（中式自走棋·已获版号/预约）"])];
}

dashboard.pipelineDetails[product.name] = {
  stage: "已获版号 · 预约中",
  stage_date: "2026-02-12",
  platforms: "iOS / Android",
  confidence: "高",
  category: "自走棋",
  developer: "杭州网易雷火科技有限公司",
  release_status: "预约中（公测日期未公布）",
  analysis: {
    core_loop: "八人对局中选择势力与幻神 → 招募并三连合成部从 → 组合阵容联动与神通 → 在无界大战场自动交战并逐轮淘汰对手。",
    social: "八名玩家同局竞技，围绕阵容信息、站位和临场转型进行策略博弈；当前公开资料未显示固定组队玩法。",
    differentiation: "以中国志怪体系替代常见西式奇幻题材，并用无界大战场、近千单位同屏和幻神系统强化大规模战斗表现。",
    readiness: "第二次玩法技术测试已经结束，产品已取得版号并开放预约；下一轮测试、公测日期和商业化表现仍待官方公布。",
  },
  gameplay_videos: [
    {
      date: "2025-12-31",
      milestone_date: "2025-12-19",
      title: "【代号：妖鬼】电表倒转，战力上亿！李靖的真正实力",
      url: "https://www.bilibili.com/video/BV15aiABREct/",
      platform: "Bilibili · 羊脂球_菌",
      source: "玩家实况 · 羊脂球_菌",
      type: "二测实机 · 完整对局（34:22）",
      evidence_kind: "video",
      verified_date: "2026-09-20",
    },
  ],
  media_reports: [
    {
      date: "2026-02-12",
      source: "TapTap 官方",
      kind: "版号节点",
      title: "《代号：妖鬼》更名《妖妖棋》并取得版号",
      summary: "官方确认产品正式定名《妖妖棋》并取得版号（ISBN 978-7-498-16357-8），继续开放预约；未公布公测日期。",
      url: officialNews,
    },
  ],
  assessment: {
    as_of: "2026-09-20",
    source: {
      label: "GRP 报告 #74 + 官方公告",
      title: "网易《代号：妖鬼》二测分析",
      url: "https://grp.woa.com/report.html?id=74",
      report_date: "2025-12-25",
      scope: "二测玩法框架、中式美术、类全战战斗、战场布局、差异化与后期战斗指引",
      author: "黄梦龙 (varokhuang)",
    },
    verdict: {
      stance: "继续观察",
      potential: "中高",
      readiness: "版号已获批 · 公测日期未公布",
      confidence: "高",
      summary: "GRP #74 确认二测以成熟酒馆式自走棋为玩法骨架，用中式美术、类全战自动战斗和战场布局塑造大兵团体验；同时报告明确指出与《炉石传说：酒馆战棋》相似度较高、后期战斗指引不足，差异化和可读性仍需下轮测试验证。",
    },
    strengths: [
      {
        module: "玩法框架",
        title: "二测已形成完整的酒馆式自走棋骨架",
        judgement: "报告指出产品基于《星际酒馆》和《炉石传说：酒馆战棋》框架搭建二测版本，核心构筑与自动战斗循环已经明确。",
        status: "GRP 确认",
        evidence_refs: ["GRP #74·二测分析"],
      },
      {
        module: "题材与美术",
        title: "中式美术为成熟玩法框架提供题材区隔",
        judgement: "报告将中式美术列为二测的主要融合方向，用东方志怪视觉和势力设计区分常见西式奇幻自走棋。",
        status: "GRP 确认",
        evidence_refs: ["GRP #74·二测分析"],
      },
      {
        module: "战斗表现",
        title: "类全战自动战斗与战场布局塑造大兵团体验",
        judgement: "报告明确记录二测融合类全战的自动战斗和战场布局，试图把阵容构筑转化为更大规模的战斗观感。",
        status: "GRP 确认",
        evidence_refs: ["GRP #74·二测分析"],
      },
    ],
    risks: [
      {
        module: "玩法差异化",
        title: "与《炉石传说：酒馆战棋》的相似度较高",
        judgement: "GRP #74 直接将相似度列为二测风险；题材和战斗演出的区隔需要进一步转化为玩法层的持续差异。",
        status: "GRP 明确问题",
        evidence_refs: ["GRP #74·二测分析"],
      },
      {
        module: "后期可读性",
        title: "后期战斗指引不足",
        judgement: "报告明确指出后期战斗指引不足；大兵团交战中的阵容关系、目标选择和胜负原因需要更清晰的反馈。",
        status: "GRP 明确问题",
        evidence_refs: ["GRP #74·二测分析"],
      },
      {
        module: "发行节奏",
        title: "版号落地后仍未公布公测日期",
        judgement: "当前无法判断下一轮测试、正式上线和商业化验证的具体时间。",
        status: "数据缺口",
        evidence_refs: ["2026-02-12 版号公告"],
      },
    ],
    changes_since_last_test: [
      {
        module: "玩法骨架",
        direction: "二测版本",
        title: "酒馆式构筑与自动战斗框架明确",
        detail: "GRP #74 记录二测基于《星际酒馆》和《炉石传说：酒馆战棋》框架，核心循环已可按成熟品类逻辑验证。",
      },
      {
        module: "差异化表达",
        direction: "二测版本",
        title: "中式美术与大兵团战斗融入成熟框架",
        detail: "二测用中式美术、类全战自动战斗和战场布局构建大兵团体验，同时暴露了酒馆战棋相似度和后期指引问题。",
      },
      {
        module: "发行准备",
        direction: "报告后节点",
        title: "正式更名并取得版号",
        detail: "该节点来自 2026-02-12 官方公告，不是 GRP #74 报告结论；当前仍未公布公测日期。",
      },
    ],
    next_watch: [
      {
        module: "发行节点",
        question: "下一轮测试和公测时间何时公布？",
        trigger: "官方测试招募、公测定档或商店预下载",
      },
      {
        module: "核心体验",
        question: "无界大战场能否兼顾规模感与策略可读性？",
        trigger: "新版本实机、测试反馈与战斗信息改版",
      },
      {
        module: "商业化",
        question: "幻神和部从养成如何处理竞技公平？",
        trigger: "付费测试、抽取系统与赛季规则",
      },
    ],
  },
  testing: {
    status: "第二次玩法技术测试结束 · 下一节点待官宣",
    latest: "2026-01-04 测试结束",
    platforms: "Android",
    test_type: "限量、不计费、删档测试",
    scope: "八人大战场、六大势力、部从构筑、幻神神通与阵容联动",
    sourceUrl: officialNews,
    sourceLabel: "《妖妖棋》TapTap 官方公告",
    records: [
      {
        date: "2025-12-19",
        type: "重大测试",
        title: "“奇谭论道”第二次玩法技术测试开启",
        lifecycle_phase: "retest",
        summary: "安卓限量、不计费、删档的第二次玩法技术测试开启，集中验证大战场自走棋规则。",
        source: "TapTap 官方",
        url: officialNews,
      },
      {
        date: "2026-01-04",
        type: "测试结束",
        title: "“奇谭论道”第二次玩法技术测试结束",
        lifecycle_phase: "retest",
        summary: "为期 16 天的测试结束，测试数据清除，产品继续进行版本优化。",
        source: "TapTap 官方",
        url: officialNews,
      },
    ],
  },
};

const neteaseGroup = dashboard.pipelineGroups.find((group) => group.name === "网易");
if (neteaseGroup) {
  neteaseGroup.track_focus = "生活模拟、社交派对、轻量合作竞技与中式自走棋方向新游";
  neteaseGroup.projects = [...new Set([...neteaseGroup.projects, product.name])];
}
const neteaseStudio = dashboard.domesticStudios.find((studio) => studio.name === "网易");
if (neteaseStudio) {
  neteaseStudio.track_focus = "生活模拟、社交派对、轻量合作竞技与中式自走棋方向新游";
  neteaseStudio.known_pipeline = [...new Set([...(neteaseStudio.known_pipeline || []), "妖妖棋（中式自走棋·已获版号/预约）"])];
}
dashboard.pipelineMeta.project_count = dashboard.pipelineGroups.filter((group) => group.name !== "试玩验证样本").flatMap((group) => group.projects).length;
dashboard.pipelineMeta.structured_assessment_count = Object.values(dashboard.pipelineDetails).filter((detail) => detail.assessment).length;
dashboard.pipelineMeta.source_reviewed_at = "2026-09-20";
syncGrpReports(games, dashboard, JSON.parse(fs.readFileSync(path.join(root, "public", "grp_reports.json"), "utf8")));

fs.writeFileSync(gamesPath, `${JSON.stringify(games, null, 2)}\n`);
fs.writeFileSync(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(JSON.stringify({ game: product.name, totalGames: games.games.length, pipelineProjects: dashboard.pipelineMeta.project_count }, null, 2));
