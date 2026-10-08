import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Casual Radar dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Casual Radar｜休闲互动游戏产品看板/);
  assert.match(html, /返回品类总览/);
  assert.match(html, /品类观测总览/);
  assert.match(html, /固定研究导航/);
  assert.match(html, /研究视图/);
  assert.match(html, /品类目录/);
  assert.match(html, /品类总览/);
  assert.match(html, /产品榜/);
  assert.match(html, /厂商总览/);
  assert.match(html, /重点品类/);
  assert.match(html, /观测品类卡片/);
  assert.match(html, /page-hero-overview/);
  assert.doesNotMatch(html, /近期重大动态/);
  assert.doesNotMatch(html, /KEY STUDIOS/);
  assert.match(html, /近期在研动态/);
  assert.doesNotMatch(html, /研究池筛选/);
  assert.doesNotMatch(html, /观察分组/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("shows data signals and version updates as expanded overview sections", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /function RadarDigest/);
  assert.match(page, /<RadarDigest events=\{signalEvents\}/);
  assert.doesNotMatch(page, /signalView|role="tablist"/);
  assert.match(page, /function latestRadarEventsByProduct/);
  assert.doesNotMatch(page, /function FocusedEvent/);
  assert.doesNotMatch(page, /focusedEvent|setFocusedEvent/);
  assert.doesNotMatch(page, /本次关注动态/);
  assert.match(page, /event\.game\.category === category/);
  assert.match(page, /latestByProduct = new Map<string, RadarEvent>/);
  assert.match(page, /<strong>\{column\.title\}<\/strong>/);
  assert.match(page, /title: "已上线产品"/);
  assert.match(page, /title: "在研新品"/);
  assert.doesNotMatch(page, /每款产品仅展示最新一条/);
  assert.match(page, /近30日版本\/玩法更新情况/);
  assert.match(page, /pipelineProducts: Game\[\]/);
  assert.match(page, /radar-digest-new/);
  assert.doesNotMatch(page, /radar-kind-stats/);
  assert.match(css, /\.radar-digest-columns\{display:grid;grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,\.92fr\)/);
  assert.match(css, /\.radar-digest-column\.pipeline/);
  assert.match(page, /<CategoryOverview\s+discovery=\{discovery\}\s+insights=\{categoryInsights\}\s+releasedGames=\{headlineGames\}\s+matrixRows=\{pipelineStageMatrixRows\}/);
  assert.match(page, /function YouyansuoSection/);
  assert.match(page, /新品发现与开发动态/);
  assert.doesNotMatch(page, /function StudioDigestCard/);
  assert.doesNotMatch(page, /className="studio-digest"/);
  assert.doesNotMatch(page, /KEY STUDIOS/);
  assert.doesNotMatch(page, /onOpenStudios/);
});

test("keeps the research sidebar expanded by default and makes it collapsible", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /const \[sidebarCollapsed, setSidebarCollapsed\] = useState\(false\)/);
  assert.match(page, /aria-expanded=\{!sidebarCollapsed\}/);
  assert.match(page, /aria-label=\{sidebarCollapsed \? "展开侧栏" : "折叠侧栏"\}/);
  assert.match(page, /sidebarCollapsed \? "sidebar collapsed" : "sidebar"/);
  assert.match(page, /sidebarCollapsed \? "sidebar-collapsed" : ""/);
  assert.match(css, /\.sidebar\.collapsed\{width:72px/);
  assert.match(css, /main\.sidebar-collapsed\{margin-left:72px\}/);
  assert.match(css, /\.sidebar-toggle:focus-visible/);
});

test("promotes and consolidates the studio research overview", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /type OverviewView = "categories" \| "ranking"/);
  assert.match(page, /\{ id: "games", label: "品类总览", kicker: "RESEARCH OVERVIEW" \}/);
  assert.match(page, /\{ id: "pipeline", label: "厂商总览", kicker: "STUDIO OVERVIEW" \}/);
  assert.doesNotMatch(page, /label: "研究总览"/);
  assert.match(page, /const showStudioOverview = tab === "pipeline" && !selectedPipeline/);
  assert.doesNotMatch(page, /onOpenStudios/);
  assert.match(page, /const openStudio = \(name: string\) => \{\s+setTab\("pipeline"\)/);
  assert.doesNotMatch(page, /chooseOverviewView\("studios"\)/);
  assert.doesNotMatch(page, />\s*<i>03<\/i><span>厂商总览<\/span>/);

  assert.match(page, /useState<"总览" \| "国内" \| "海外">\("总览"\)/);
  assert.match(page, /<span>总览面板<\/span>/);
  assert.match(page, /<span>国内厂商<\/span>/);
  assert.match(page, /<span>海外厂商<\/span>/);
  assert.match(page, /studioScope === "总览" && <section className="pipeline-market-overview pipeline-studio-overview"/);
  assert.match(page, /厂商在研动向/);
  assert.match(page, /厂商 × 在研品类/);
  assert.match(page, /品类供给与验证/);
  assert.match(page, /className="pipeline-vendor-board-heading"/);
  assert.match(page, /studioScope !== "海外" && <div className="pipeline-vendor-board-heading"/);
  assert.match(page, /重点厂商在研动向/);
  assert.match(page, /const showStudioSidebar = tab === "pipeline" && !selectedPipeline && !selectedStudio/);
  assert.match(page, /id="studio-sidebar-navigation"/);
  assert.match(page, /studioScope !== "海外" && <section className="pipeline-vendor-board"/);
  assert.doesNotMatch(page, /<section className="domestic-studio-directory"/);
  assert.match(page, /studioScope === "海外" && <div className="studio-tier-groups pipeline-overseas-directory"/);
  assert.match(page, /studioScope === "总览" && <section className="pipeline-market-overview pipeline-observer-shell"/);
  assert.match(css, /\.studio-overview-link\{height:48px/);
  assert.match(css, /\.studio-scope-branches\{[^}]*border-left:1px solid #dfe7f2/);
  assert.doesNotMatch(page, /className="toolbar studio-toolbar pipeline-board-toolbar"/);
  assert.match(page, /className="pipeline-vendor-board"/);
  assert.match(page, /focusDomesticStudios/);
  assert.match(page, /focusDomesticEntries\.map/);
  assert.doesNotMatch(page, /focusDomesticColumns/);
  assert.doesNotMatch(page, /pipeline-vendor-column/);
  assert.match(page, /pipeline-vendor-summary-card/);
  assert.match(page, /function StudioPublishedStrip/);
  assert.match(page, /studio-published-strip/);
  assert.match(page, /<GameIcon game=\{game \|\| \{ name \}\} className="studio-pipeline-icon" \/>/);
  assert.match(page, /<em>已发<\/em>/);
  assert.match(page, /pipeline-vendor-mix/);
  assert.match(page, /pipeline-vendor-mix-legend/);
  assert.doesNotMatch(page, /pipelineDirectionDonutGradient/);
  assert.match(page, /compact\s+\? <GameIcon/);
  assert.match(css, /pipeline-vendor-summary-card>\.studio-published-strip\.compact\{display:grid;grid-template-columns:auto minmax\(0,1fr\)/);
  assert.match(css, /pipeline-vendor-summary-card>\.studio-published-strip\.compact \.studio-pipeline-products\{display:flex;grid-template-columns:none;flex-flow:row nowrap/);
  assert.ok(
    css.indexOf(".pipeline-vendor-summary-card>.studio-published-strip.compact{display:grid") < css.indexOf("@media(max-width:1439px)"),
    "compact published-product layout must be global rather than limited to a small-screen media query",
  );
  assert.match(css, /\.pipeline-vendor-mix \.pipeline-direction-stack\{height:14px\}/);
  assert.match(css, /\.pipeline-vendor-summary-card \.pipeline-vendor-project\{grid-template-columns:30px/);
  assert.match(page, /pipeline-observer-group/);
  assert.match(page, /OTHER STUDIO PIPELINE/);
  assert.match(page, /PLAYTEST VALIDATION/);
  assert.match(page, /其他厂商在研新品/);
  assert.match(page, /试玩验证样本/);
  assert.match(page, /tab === "pipeline" && !selectedPipeline && !selectedStudio/);
  assert.doesNotMatch(page, /重点厂商研发盘面/);
  assert.doesNotMatch(page, /STUDIO LANDSCAPE/);
  assert.doesNotMatch(page, /<h2>重点厂商总览<\/h2>/);
  assert.doesNotMatch(page, /重点厂商纵览/);
  assert.match(css, /\.pipeline-vendor-board\{[^}]*grid-auto-rows:1fr;[^}]*align-items:stretch/);
  assert.match(css, /\.pipeline-vendor-summary-card\{[^}]*height:100%/);
  assert.match(css, /\.pipeline-vendor-projects\{[^}]*flex:1/);
  assert.match(css, /\.pipeline-vendor-project-copy>small\{[^}]*white-space:normal;[^}]*overflow:visible;[^}]*text-overflow:clip;[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.pipeline-vendor-project-copy>p\{[^}]*white-space:normal;[^}]*overflow:visible;[^}]*text-overflow:clip;[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.pipeline-vendor-project-title>strong\{[^}]*white-space:normal;[^}]*overflow:visible;[^}]*text-overflow:clip;[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(page, /\{item\.confidence \|\| "中"\}置信度<\/b>/);
  assert.doesNotMatch(css, /\.pipeline-vendor-project-title>b/);
  assert.match(css, /@media\(max-width:800px\)[\s\S]*?\.pipeline-vendor-board\{grid-auto-rows:auto\}/);
});

test("turns category cards into research and popular-game updates with a representative product", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /<b>在研产品<\/b>/);
  assert.match(page, /游戏版本动态/);
  assert.match(page, /pipelineUpdates/);
  assert.match(page, /popularGameUpdates/);
  assert.match(page, /代表性产品/);
  assert.match(page, /representativeProducts/);
  assert.match(page, /representativeCandidates\.slice\(0, 3\)/);
  assert.match(page, /点击查看游戏详情/);
  assert.match(page, /className="category-representative-item" onClick=\{\(\) => onOpenGame\(game\)\}/);
  assert.match(page, /onOpenGame=\{setSelected\}/);
  assert.match(page, /按近期重点动态数量排序/);
  assert.match(page, /\[\.\.\.insights\]\.sort\(\(a, b\) => b\.recentEvents\.length - a\.recentEvents\.length\)/);
  assert.doesNotMatch(page, /product\.reason/);
  assert.match(page, /className="category-update-item"/);
  assert.match(page, /<strong>\{event\.game\.name\}<\/strong>：\{event\.title\}/);
  assert.match(page, /<h3><button className="category-title-link" onClick=\{\(\) => onOpenCategory\(insight\.name\)\}/);
  assert.doesNotMatch(page, /<footer><button onClick=\{\(\) => onOpenCategory\(insight\.name\)\}>进入品类/);
  assert.match(page, /function categoryEventStrategicScore/);
  assert.match(page, /function buildStrategicPipelineEvents/);
  assert.match(page, /strategicPipeline \? 100/);
  assert.match(page, /款已上线/);
  assert.match(page, /款在研/);
  assert.match(page, /CATEGORY_OVERVIEW_ORDER = \["派对闯关", "模拟经营类", "捉宠类", "社交-多人合作类"\]/);
  assert.match(page, /insight\.name !== "其他类"/);
  assert.match(page, /data\.domesticStudios\.flatMap/);
  assert.match(page, /sort\(rankEvents\)\.slice\(0, 3\)/);
  assert.match(css, /category-card-grid\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1439px\)\{\.category-card-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /@media\(max-width:1099px\)\{\.category-card-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.doesNotMatch(css, /@media\(min-width:801px\) and \(max-width:1439px\)/);
  assert.doesNotMatch(page, /样本月收入/);
  assert.doesNotMatch(page, /收入覆盖/);
  assert.doesNotMatch(page, /头部产品/);
  assert.doesNotMatch(page, /<b>新游供给<\/b>/);
  assert.doesNotMatch(page, /<b>玩法变化<\/b>/);
  assert.doesNotMatch(page, /hero-metrics/);
  assert.doesNotMatch(css, /hero-metrics/);
  assert.match(css, /\.category-representative/);
  assert.match(css, /\.category-representative-item:hover/);
  assert.match(css, /\.category-representative-item:focus-visible/);
  assert.doesNotMatch(css, /\.category-thesis\{[^}]*min-height/);
  assert.match(css, /\.category-representative-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.category-findings \.category-update-item strong/);
  assert.match(css, /\.category-title-link\{/);
  assert.doesNotMatch(css, /\.category-card>footer/);
});

test("turns the product ranking into a cross-platform sortable product list", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /type RankingMetric = "mobile_dau" \| "pc_acu"/);
  assert.match(page, /休闲产品整体排行/);
  assert.match(page, /按移动端 DAU 降序排列/);
  assert.match(page, /按 PC 端 ACU 降序排列/);
  assert.match(page, /chooseRankingMetric\("mobile_dau"\)/);
  assert.match(page, /chooseRankingMetric\("pc_acu"\)/);
  assert.match(page, /aria-sort=/);
  assert.match(page, /PC端 ACU/);
  assert.doesNotMatch(page, /rankingCoverage/);
  assert.match(page, /const PRODUCT_PAGE_SIZE = 20/);
  assert.match(page, /paginatedGames/);
  assert.match(page, /aria-label="产品榜分页"/);
  assert.match(page, /上一页/);
  assert.match(page, /下一页/);
  assert.match(page, /品类 \/ 类型/);
  assert.match(page, /热门游戏/);
  assert.match(page, /versionChangedGameNames/);
  assert.match(page, /版本变动/);
  assert.doesNotMatch(page, /rankingCategoryEvents/);
  assert.doesNotMatch(page, /<h2>品类动态<\/h2>/);
  assert.doesNotMatch(page, /全部产品样本/);
  assert.doesNotMatch(page, /PC近30日收入/);
  assert.doesNotMatch(page, /rankingRevenue/);
  assert.doesNotMatch(page, /移动端 DAU 与 PC端 ACU 分列呈现/);
  assert.doesNotMatch(page, /games\.slice\(0, 50\)/);
  assert.doesNotMatch(page, /当前展示前 50 条/);
  assert.doesNotMatch(page, /品类 \/ 研究池/);
  assert.doesNotMatch(page, /选择产品榜排序口径/);
  assert.doesNotMatch(css, /\.ranking-sort-select/);
  assert.match(css, /\.ranking-sort-button/);
  assert.match(css, /\.page-hero-ranking/);
  assert.match(css, /\.product-pagination/);
  assert.match(css, /\.game-head \.active-sort/);
  assert.doesNotMatch(css, /\.ranking-category-dynamics/);
  assert.match(css, /\.game-row\.version-changed/);
  assert.match(css, /background:#fffaf0/);
});

test("searches every canonical product by Chinese, English, and historical aliases", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  assert.match(page, /const candidates = keyword \? data\.games\.filter\(\(game\) => !game\.alias_of\) : headlineGames/);
  assert.match(page, /game\.name_cn, game\.name_zh, game\.en, game\.name_en, \.\.\.\(Array\.isArray\(game\.aliases\)/);
  assert.match(page, /搜索覆盖中文名、英文名与历史代号/);
  assert.match(page, /game\.lifecycle\?\.pipeline === true && data\.pipelineDetails\[game\.name\] \? openPipelineDetail/);
});

test("renders released product details as a full page with honest three-month trend coverage", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");
  const trends90d = JSON.parse(await readFile(path.join(projectRoot, "public/databrain_trends_90d.json"), "utf8"));
  const latestMetrics = JSON.parse(await readFile(path.join(projectRoot, "public/databrain_latest_metrics.json"), "utf8"));
  const databrainEvents = JSON.parse(await readFile(path.join(projectRoot, "public/databrain_events.json"), "utf8"));
  const weeklyScan = JSON.parse(await readFile(path.join(projectRoot, "public/weekly_scan.json"), "utf8"));

  assert.match(page, /90 DAY TREND/);
  assert.match(page, /近 3 个月数据趋势/);
  assert.match(page, /function ProductTrendPanel/);
  assert.match(page, /platform-trend-section/);
  assert.match(page, /!selectedTrendScopeIsPc && <ProductTrendPanel game=\{selected\} trend=\{selectedTrend \|\|/);
  assert.match(page, /selectedTrend && selectedTrendScopeIsPc \? <ProductTrendPanel game=\{selected\} trend=\{selectedTrend\}/);
  assert.doesNotMatch(page, /className="detail-section trend-section"/);
  assert.match(page, /function TrendUnavailable/);
  assert.doesNotMatch(page, /trend-coverage-note/);
  assert.match(page, /aria-label="返回上一页"/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.doesNotMatch(page, />30 DAY TREND</);
  assert.doesNotMatch(page, />近 30 日数据趋势</);
  assert.match(css, /\.drawer-backdrop\{[^}]*background:#f4f7fb/);
  assert.match(css, /\.detail-drawer\{width:100%;min-height:100%/);
  assert.match(css, /\.drawer-content\{max-width:1320px;margin:0 auto/);
  assert.doesNotMatch(css, /\.trend-coverage-note/);
  assert.match(css, /\.trend-unavailable/);
  assert.match(css, /\.platform-trend-section\{/);
  assert.doesNotMatch(css, /backdrop-filter:blur/);
  assert.doesNotMatch(css, /width:min\(780px,100%\)/);
  const eggy = trends90d.games["蛋仔派对"];
  assert.equal(eggy.activity.granularity, "daily");
  assert.equal(eggy.revenue.granularity, "daily");
  assert.ok(eggy.activity.points.length >= 80);
  assert.ok(eggy.revenue.points.length >= 80);
  assert.ok((new Date(eggy.end_date) - new Date(eggy.start_date)) / 86400000 + 1 >= 80);
  assert.ok(latestMetrics.mobile_games["蛋仔派对"].dau_data_date >= "2026-09-08");
  assert.match(latestMetrics.meta.query_range.at(-1), /^2026-\d{2}-\d{2}$/);
  assert.ok(latestMetrics.meta.query_range.at(-1) <= new Date().toISOString().slice(0, 10));
  assert.ok(Object.keys(trends90d.games).length >= 79);
  assert.ok(trends90d.meta.games_with_80d_activity >= 70 || trends90d.meta.games_with_90d_activity >= 70);
  assert.ok(databrainEvents.meta && Array.isArray(databrainEvents.meta.query_range));
  assert.equal(weeklyScan.meta.window.at(-1), "2026-09-15");
  assert.equal(weeklyScan.meta.newly_added_to_pool, 1);
  assert.equal(weeklyScan.new_games.find((game) => game.name === "妖妖棋").disposition, "已加入主追踪池");
  assert.ok(weeklyScan.major_updates.some((item) => item.game_name === "王者万象棋" && item.event_date === "2026-09-10"));
  assert.doesNotMatch(page, /function WeeklyScanPanel/);
  assert.doesNotMatch(page, /weekly_scan\.json/);
  assert.doesNotMatch(page, /本周扫描/);
  assert.doesNotMatch(page, /DataBrain 更新/);
  assert.doesNotMatch(css, /\.weekly-scan-panel\{/);
  assert.doesNotMatch(css, /\.weekly-scan-databrain-grid\{/);
  assert.match(page, /<span>DAU（日频）<\/span>/);
  assert.match(page, /onPointerMove=\{\(event\) => selectNearestPoint/);
  assert.match(page, /悬停或使用左右方向键查看每日数据/);
  assert.match(page, /role="status"/);
  assert.match(page, /"ArrowLeft", "ArrowRight", "Home", "End"/);
  assert.match(page, /const \[rangeStartIndex, setRangeStartIndex\] = useState\(0\)/);
  assert.match(page, /visiblePoints = points\.slice\(safeStartIndex\)/);
  assert.match(page, /<input type="range"/);
  assert.match(page, /调整起始日期/);
  assert.match(page, /setRangeStartIndex\(Number\(event\.currentTarget\.value\)\)/);
  assert.match(page, /buildTrendEvents/);
  assert.match(page, /events=\{trendEvents\}/);
  assert.match(page, /databrain_events\.json/);
  assert.match(page, /databrain_research\.json/);
  assert.match(page, /published_date/);
  assert.match(page, /timeline: false/);
  assert.match(page, /externalEvents=\{data\.databrainEvents\?\.\[selected\.name\]\}/);
  assert.match(page, /chart-event-marker/);
  assert.match(css, /\.chart-tooltip\{/);
  assert.match(css, /\.chart-hover-line\{/);
  assert.match(css, /\.chart-range-control\{/);
  assert.match(css, /\.chart-event-marker\{/);
  assert.match(css, /touch-action:pan-y/);
});

test("keeps product categories and studio ownership aligned with the canonical records", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const gameByName = new Map(games.games.map((game) => [game.name, game]));
  const dashboardGameByName = new Map(dashboard.games.map((game) => [game.name, game]));
  const onceHuman = gameByName.get("七日世界");
  const bagFight = gameByName.get("Bag Fight");

  assert.equal(onceHuman.category, "社交-多人合作类");
  assert.equal(onceHuman.track, "多人合作");
  assert.equal(dashboardGameByName.get("七日世界").category, onceHuman.category);
  assert.doesNotMatch(`${onceHuman.category} ${onceHuman.track}`, /捉宠/);

  assert.equal(bagFight.developer, "Voodoo");
  assert.equal(bagFight.publisher, "Voodoo");
  assert.equal(bagFight.profile.developer, "Voodoo");
  assert.equal(bagFight.profile.publisher, "Voodoo");
  assert.equal(dashboardGameByName.get("Bag Fight").developer, "Voodoo");
  assert.ok(dashboard.overseasStudios.Voodoo.pool_games.includes("Bag Fight"));
  assert.equal((dashboard.overseasStudios.Supercell.pool_games || []).includes("Bag Fight"), false);
});

test("replaces domestic key-studio vanity metrics with a sourced focus-team map", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.match(page, /FOCUS_TEAM_STUDIOS = new Set\(\["腾讯", "网易", "米哈游", "莉莉丝", "字节（朝夕光年）"\]\)/);
  assert.match(page, /function StudioFocusTeamMap/);
  assert.match(page, /关注品类研发团队/);
  assert.match(page, /重点在研项目与热门已发产品/);
  assert.match(page, /const releasedRows = \(studio\.known_published \|\| \[\]\)\.flatMap/);
  assert.match(page, /kind: "热门产品" as const/);
  assert.match(page, /kind === "热门产品" && game \? onOpenGame\(game\) : onOpenPipeline\(project\)/);
  assert.match(page, /<span>团队<\/span><span>对应项目<\/span><span>关注方向<\/span>/);
  assert.doesNotMatch(page, /团队 \/ 对应项目/);
  assert.match(page, /className="studio-team-name"/);
  assert.match(page, /className="studio-team-project-cell"/);
  assert.match(page, /团队人数/);
  assert.match(page, /负责人/);
  assert.match(page, /过往明星产品/);
  assert.match(page, /function isUndisclosedTeamValue/);
  assert.match(page, /未披露\|未公开\|待确认/);
  assert.match(page, /filter\(\(leader\) => !isUndisclosedTeamValue\(leader\.name\)\)/);
  assert.match(page, /compactTeamValue\(profile\?\.size\)/);
  assert.match(page, /同工作室、原班团队或明确组织口径/);
  assert.match(page, /showFocusTeamMap \? <StudioFocusTeamMap/);
  assert.match(page, /onOpenGame=\{onOpenGame\}/);
  assert.doesNotMatch(page, /!selectedPipeline && !showFocusTeamStudio/);
  assert.match(page, /约 40 人（2026 年媒体采访口径）/);
  assert.match(page, /制作人", name: "卡布"/);
  assert.match(css, /\.studio-focus-team-map/);
  assert.match(css, /\.studio-team-row/);
  assert.match(css, /grid-template-columns:minmax\(175px,1\.2fr\) minmax\(125px,\.85fr\)/);
});

test("shows verified development ownership and team context for Eggy Party", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const eggy = games.games.find((game) => game.name === "蛋仔派对");

  assert.equal(eggy.development_profile.company, "网易");
  assert.equal(eggy.development_profile.team, "网易《蛋仔派对》项目组");
  assert.match(eggy.development_profile.early_team_size, /未披露具体人数/);
  assert.match(eggy.development_profile.early_team_size, /中等偏小规模/);
  assert.equal(eggy.development_profile.producer, "Kwan");
  assert.match(eggy.development_profile.development_cycle, /约 1 年半/);
  assert.match(eggy.development_profile.prior_experience, /《河狸计划》/);
  assert.match(eggy.development_profile.team_note, /未见权威公开信源明确披露/);
  assert.equal(eggy.development_profile.sources.length, 3);
  assert.ok(eggy.development_profile.sources.every((source) => source.url.startsWith("https://")));
  assert.match(page, /前期开发人数/);
  assert.match(page, /团队过往经验/);
  assert.match(page, /团队信息仅采用可核验公开口径/);
  assert.match(page, /development-profile-sources/);
});

test("covers every released product with development ownership and enriches verified priority games", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const profiles = JSON.parse(await readFile(path.join(projectRoot, "public/development-profiles.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const pipelineNames = new Set((dashboard.pipelineGroups || []).flatMap((group) => group.projects));
  const pipelineStatus = /在研|研发|测试|首测|二测|内测|删档|不删档|冒泡|预约|未上线|Early Access|\bEA\b|试玩|上线前|上线验证|公测预约/u;
  const released = games.games.filter((game) => {
    const lifecycle = game.lifecycle && typeof game.lifecycle === "object" ? game.lifecycle : {};
    const statusText = `${game.release_status || ""} ${game.status || ""} ${lifecycle.stage || ""} ${lifecycle.reason || ""}`;
    if (lifecycle.pipeline === false && /已上线|公测|活跃|运营中/.test(statusText)) return true;
    if (pipelineNames.has(game.name) || lifecycle.pipeline === true) return false;
    if (pipelineStatus.test(statusText)) return false;
    return /已上线|公测|活跃|运营中/.test(statusText);
  });

  assert.ok(released.length >= 106);
  assert.equal(Object.keys(profiles).length, released.length);
  assert.ok(Object.keys(profiles).every((name) => released.some((game) => game.name === name)));
  assert.ok(Object.keys(profiles).every((name) => !pipelineNames.has(name) || games.games.find((game) => game.name === name)?.lifecycle?.pipeline === false));
  assert.equal(profiles["Among Us"].early_team_size, "3 人");
  assert.equal(profiles["星露谷物语"].development_cycle, "4.5 年");
  assert.equal(profiles["致命公司"].early_team_size, "1 人");
  assert.equal(profiles.PEAK.early_team_size, "7 人");
  assert.match(profiles["超自然行动组"].early_team_size, /不足 10 人/);
  assert.match(profiles["心动小镇"].early_team_size, /接近 100 人/);
  assert.equal(profiles["蛋仔派对"].coverage_level, "深度档案");
  assert.equal(profiles["宝可梦大集结"].coverage_level, "基础归属");
  assert.match(profiles["宝可梦大集结"].sources[0].url, /timistudios\.com/);
  assert.match(profiles["炉石传说：酒馆战棋"].sources[0].url, /blizzard\.com/);
  assert.equal(profiles.BigWalk.coverage_level, "深度档案");
  assert.match(profiles.BigWalk.early_team_size, /核心 4 人/);
  assert.equal(profiles["随机骰子"].company, "111%");
  assert.equal(profiles["背包乱斗"].company, "PlayWithFurcifer");
  assert.equal(profiles["药剂工艺"].company, "niceplay games");
  assert.equal(profiles["创世理想乡"].company, "Pocketpair");
  assert.equal(games.games.find((game) => game.name === "随机骰子").developer, "111%");
  assert.equal(games.games.find((game) => game.name === "背包乱斗").developer, "PlayWithFurcifer");
  assert.equal(games.games.find((game) => game.name === "七龙珠：破界斗士").developer, "Dimps Corporation");
  assert.equal(games.games.find((game) => game.name === "BigWalk").profile.release_date, "2026-08-04");
  assert.equal(profiles.Dressmaker.coverage_level, "深度档案");
  assert.match(profiles.Dressmaker.early_team_size, /媒体报道/);
  assert.equal(Object.values(profiles).filter((profile) => profile.coverage_level === "深度档案").length, 19);
  assert.equal(Object.values(profiles).filter((profile) => profile.coverage_level === "基础归属").length, released.length - 19);
  assert.ok(Object.values(profiles).filter((profile) => profile.coverage_level === "基础归属").every((profile) => (
    profile.early_team_size === "未公开"
    && profile.producer === "未公开"
    && profile.development_cycle === "未公开"
    && /不用于推断/.test(profile.sources[0].note)
  )));
  assert.ok(Object.values(profiles).every((profile) => profile.sources?.length > 0));
  assert.ok(Object.values(profiles).flatMap((profile) => profile.sources).every((source) => source.url.startsWith("https://")));
  assert.match(page, /attachReleasedDevelopmentProfiles/);
  assert.match(page, /development-profiles\.json/);
  assert.match(page, /该产品尚未进入研发归属资料表/);
});

test("all product and pipeline icon references resolve to local assets", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const pipelineIcons = JSON.parse(await readFile(path.join(projectRoot, "public/pipeline-icons.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const css = await readFile(path.join(projectRoot, "app/globals.css"), "utf8");

  assert.ok(games.games.length >= 100);
  assert.ok(games.games.every((game) => game.icon_path));
  assert.ok(Object.keys(pipelineIcons).length >= 11);
  assert.match(pipelineIcons["粒粒的小人国"].path, /taptap-772909/);
  assert.match(pipelineIcons["王者万象棋"].path, /taptap-243110/);
  assert.match(pipelineIcons["妖妖棋"].path, /taptap-756756/);
  assert.match(pipelineIcons["Totally Mall"].path, /pipeline-totally-mall/);
  assert.match(page, /pipeline-icons\.json/);
  assert.match(page, /pipeline-vendor-board/);
  assert.match(page, /pipeline-vendor-summary-card/);
  assert.match(page, /pipeline-vendor-board-heading/);
  assert.match(page, /pipeline-vendor-mix/);
  assert.doesNotMatch(page, /pipeline-vendor-kpis/);
  assert.doesNotMatch(page, /<dt>主押方向<\/dt>/);
  assert.doesNotMatch(page, /<dt>实机覆盖<\/dt>/);
  assert.match(page, /className=\{"direction-" \+ segment\.id\}/);
  assert.match(page, /segment\.count/);
  assert.match(page, /pipeline-vendor-project/);
  assert.match(page, /pipeline-vendor-name-link/);
  assert.match(page, /查看\$\{studio\.name\}厂商详情/);
  assert.match(page, /openStudio\(studio\.name\)/);
  assert.doesNotMatch(page, /activePipelineGroupName/);
  assert.match(page, /pipeline-market-overview/);
  assert.match(page, /厂商 × 在研品类/);
  assert.match(page, /品类供给与验证/);
  assert.match(page, /pipeline-direction-donut/);
  assert.match(page, /conic-gradient/);
  assert.match(page, /page-hero-pipeline/);
  assert.match(page, /近期重点动态/);
  assert.match(page, /event\.kind === "版本更新"/);
  assert.match(page, /recentEventByGame = new Map<string, RadarEvent>/);
  assert.match(page, /categoryEventPriority\[event\.kind\]/);
  assert.match(page, /\(\?:新增\|全新\|新\)\(\?:玩法\|地图\|角色\|系统\|模式\)/);
  assert.match(page, /productType: "热门游戏" \| "在研新品"/);
  assert.match(page, /event\.productType === "在研新品"/);
  assert.match(page, /knownGame && isReleasedProduct\(knownGame\) \? "热门游戏" : "在研新品"/);
  assert.match(page, /const showResearchSidebar = tab === "games"/);
  assert.doesNotMatch(page, /research-subnav-wrap/);
  assert.doesNotMatch(page, /const \[scope, setScope\]/);
  assert.doesNotMatch(page, /categoryScope|side-scope-group/);
  assert.doesNotMatch(page, /hero-metrics/);
  assert.doesNotMatch(page, /当前跑得怎么样/);
  assert.doesNotMatch(page, /pipeline-signal-overview|pipelineSignalSpotlights|PIPELINE_SIGNAL_SPOTLIGHTS/);
  assert.match(page, /function PipelineStageMatrix/);
  assert.match(page, /<h2>近期在研动态<\/h2>/);
  assert.match(page, /pipeline-stage-chart-axis/);
  assert.match(page, /pipeline-stage-chart-node/);
  assert.match(page, /recentUpdateStart = shiftDate\(asOf, -6\)/);
  assert.match(page, /date >= recentUpdateStart && date <= asOf/);
  assert.match(page, /recordText\(record, "observed_date"\)/);
  assert.match(page, /className="recent" \/>近 7 天更新/);
  assert.match(page, /recently-updated/);
  assert.match(page, /pipeline-stage-chart-recent-badge/);
  assert.match(page, /<em>7日更新<\/em>/);
  assert.match(css, /pipeline-stage-chart-node\.recently-updated/);
  assert.match(page, /function buildRecentLaunchEntries/);
  assert.doesNotMatch(page, /aria-label="近期上线时间轴"/);
  assert.match(page, /id: "launch", label: "上线"/);
  assert.match(page, /recentLaunches=\{recentLaunches\}/);
  assert.match(page, /onOpenGame=\{onOpenGame\}/);
  assert.doesNotMatch(css, /pipeline-stage-chart-zone:empty:after/);
  const matrixComponent = page.match(/function PipelineStageMatrix[\s\S]*?function CategoryOverview/)?.[0] || "";
  assert.ok(matrixComponent.lastIndexOf("pipeline-stage-chart-axis") > matrixComponent.indexOf("visibleRows.map"));
  assert.doesNotMatch(page, /近期在研动态矩阵/);
  assert.match(page, /label: "首曝"/);
  assert.match(page, /label: "一测"/);
  assert.match(page, /label: "二测"/);
  assert.match(page, /label: "终测"/);
  const matrixCategoryBlock = page.match(/const PIPELINE_CATEGORIES[\s\S]*?=\s*\[([\s\S]*?)\]\s+as const;/)?.[1] || "";
  assert.match(matrixCategoryBlock, /label: "模拟经营类"/);
  assert.match(matrixCategoryBlock, /label: "自走棋"/);
  assert.match(matrixCategoryBlock, /label: "捉宠类"/);
  assert.match(matrixCategoryBlock, /label: "多人合作类"/);
  const cooperationProjects = matrixCategoryBlock.match(/label: "多人合作类"[\s\S]*?projects: \[([^\]]+)\]/)?.[1] || "";
  for (const name of ["雾海之下", "诡影藏锋", "生活派对", "BigWalk", "未眠野", "源初之结", "Project63", "Dear Passengers"]) {
    assert.ok(cooperationProjects.includes(`"${name}"`), `${name} should be in the cooperation matrix`);
  }
  assert.doesNotMatch(matrixCategoryBlock, /社交派对类/);
  assert.doesNotMatch(matrixCategoryBlock, /生活模拟 \/ 社交经营|轻策略 \/ 自走棋|融合经营 \/ 休闲玩法/);
  assert.match(page, /const PIPELINE_MATRIX_CATEGORIES = PIPELINE_CATEGORIES/);
  assert.match(page, /PIPELINE_MATRIX_CATEGORIES\.map\(\(categoryGroup\)/);
  assert.match(css, /pipeline-stage-chart-axis:after\{[^}]*top:50%/);
  assert.match(css, /pipeline-stage-chart-tick strong\{[^}]*background:#f7f9fd/);
  assert.doesNotMatch(page, /纵轴 · 品类|在研阶段 →/);
  assert.match(page, /pipeline-stage-chart-spacer/);
  assert.match(page, /matrixRows=\{pipelineStageMatrixRows\}/);
  assert.match(page, /onOpenPipeline=\{openPipelineDetail\}/);
  assert.match(page, /entry.target === "game"/);
  assert.match(page, /const pipelineReturnRef = useRef/);
  assert.match(page, /const closePipelineDetail = \(\) =>/);
  assert.match(page, /className="pipeline-back" onClick=\{closePipelineDetail\} aria-label="返回上一页"/);
  assert.doesNotMatch(page, /className="pipeline-back"[^>]*>← 返回厂商总览/);
  assert.match(page, /Only classify the milestone itself/);
  assert.doesNotMatch(page, /const text = `\$\{recordText\(milestone, "type"\)\}[\s\S]{0,220}recordText\(milestone, "summary"\)/);
  const directionBlock = page.match(/const PIPELINE_CATEGORIES[\s\S]*?=\s*\[([\s\S]*?)\]\s+as const;/)?.[1] || "";
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const gamesSource = await readFile(path.join(projectRoot, "public/games.json"), "utf8");
  const creatureDirection = directionBlock.match(/id: "creature"[\s\S]*?projects: \[([^\]]+)\]/)?.[1] || "";
  assert.match(directionBlock, /label: "捉宠类"/);
  assert.doesNotMatch(directionBlock, /生活模拟 \/ 社交经营|轻策略 \/ 自走棋|捉宠 \/ 宠物收集|搜打撤 \/ 合作竞技|社交派对 \/ 轻合作|融合经营 \/ 休闲玩法/);
  assert.equal(dashboard.pipelineDetails["粒粒的小人国"].testing.records.at(-1).type, "二测");
  assert.match(creatureDirection, /"崩坏：因缘精灵"/);
  assert.match(creatureDirection, /"塔塔冒险队"/);
  for (const name of ["崩坏：因缘精灵", "塔塔冒险队"]) {
    assert.equal(games.games.find((game) => game.name === name)?.category, "捉宠类");
    assert.equal(dashboard.pipelineDetails[name]?.category, "捉宠类");
  }
  assert.equal(games.games.find((game) => game.name === "诡影藏锋")?.category, "社交-多人合作类");
  assert.equal(dashboard.pipelineDetails["诡影藏锋"]?.category, "社交-多人合作类");
  assert.doesNotMatch(directionBlock, /桌宠/);
  assert.doesNotMatch(JSON.stringify(dashboard.categoryMeta), /桌宠/);
  assert.match(dashboard.categoryMeta["模拟经营类"].desc, /田园生活.*社区建设.*制作交易.*冒险经营.*多人生活 MMO/);
  assert.doesNotMatch(gamesSource, /桌宠/);
  for (const name of Object.keys(dashboard.pipelineDetails || {})) {
    assert.ok(directionBlock.includes('"' + name + '"'), "pipeline direction is missing " + name);
  }
  assert.match(page, /DATA_VERSION/);

  const paths = [
    ...games.games.map((game) => game.icon_path),
    ...Object.values(pipelineIcons).map((icon) => icon.path),
  ];
  for (const assetPath of new Set(paths)) {
    await access(path.join(projectRoot, "public", assetPath.replace(/^\//, "")));
  }
});

test("tracks NetEase Yaoyao Chess as an unreleased auto-chess project", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const game = games.games.find((item) => item.name === "妖妖棋");
  const detail = dashboard.pipelineDetails["妖妖棋"];
  const neteaseGroup = dashboard.pipelineGroups.find((group) => group.name === "网易");

  assert.equal(games.games.filter((item) => item.name === "妖妖棋").length, 1);
  assert.equal(game.category, "自走棋");
  assert.equal(game.lifecycle.pipeline, true);
  assert.match(game.developer, /网易雷火/);
  assert.match(game.icon_path, /taptap-756756/);
  assert.ok(neteaseGroup.projects.includes("妖妖棋"));
  assert.match(detail.stage, /已获版号/);
  assert.ok(detail.testing.records.some((record) => record.date === "2025-12-19" && record.title.includes("测试开启")));
  assert.ok(detail.testing.records.some((record) => record.date === "2026-01-04" && record.title.includes("测试结束")));
  assert.ok(detail.media_reports.some((record) => record.date === "2026-02-12" && record.kind === "版号节点"));
  assert.ok(detail.media_reports.some((record) => record.report_id === 74 && record.source === "GRP"));
  assert.equal(detail.assessment.source.url, "https://grp.woa.com/report.html?id=74");
  assert.equal(detail.assessment.strengths.length, 3);
  assert.ok(detail.assessment.strengths.every((finding) => finding.evidence_refs.includes("GRP #74·二测分析")));
  assert.ok(detail.assessment.risks.some((finding) => finding.title.includes("酒馆战棋") && finding.status === "GRP 明确问题"));
  assert.ok(detail.assessment.risks.some((finding) => finding.title.includes("后期战斗指引") && finding.status === "GRP 明确问题"));
  assert.ok(detail.assessment.changes_since_last_test.some((change) => change.title.includes("大兵团战斗")));
  assert.match(page, /"妖妖棋": \{/);
  assert.match(page, /网易雷火《妖妖棋》项目组/);
  assert.match(page, /DataBrain Management 已核查/);
  assert.match(page, /当前预约中/);
  assert.ok(detail.gameplay_videos.some((video) => video.url.includes("BV15aiABREct") && video.milestone_date === "2025-12-19"));
  assert.equal(detail.gameplay_videos.find((video) => video.url.includes("BV15aiABREct"))?.type, "二测实机 · 完整对局（34:22）");
  assert.match(page, /projects: \["妖妖棋", "王者万象棋"/);
});

test("keeps pipeline and non-live samples out of the headline product list", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const pipelineNames = new Set((dashboard.pipelineGroups || []).flatMap((group) => group.projects));
  const pipelineStatus = /在研|研发|测试|首测|二测|内测|删档|不删档|冒泡|预约|未上线|Early Access|\bEA\b|试玩|上线前|上线验证|公测预约/u;
  const isHeadline = (game) => {
    if (game.alias_of) return false;
    const lifecycle = game.lifecycle && typeof game.lifecycle === "object" ? game.lifecycle : {};
    const statusText = `${game.release_status || ""} ${game.status || ""} ${lifecycle.stage || ""} ${lifecycle.reason || ""}`;
    if (pipelineNames.has(game.name) || lifecycle.pipeline === true) return false;
    if (lifecycle.pipeline === false && /已上线|活跃|运营中/.test(statusText)) return true;
    if (pipelineStatus.test(statusText)) return false;
    return /已上线|公测|活跃|运营中/.test(statusText);
  };
  const headline = games.games.filter(isHeadline);

  assert.ok(headline.length < games.games.length);
  assert.equal(headline.some((game) => pipelineNames.has(game.name)), false);
  assert.equal(headline.some((game) => ["代号：奇旅", "星布谷地", "粒粒的小人国", "山海奇旅", "Project63", "Dear Passengers"].includes(game.name)), false);
  assert.ok(["王者万象棋", "Aniimo"].every((name) => headline.some((game) => game.name === name)));
  assert.ok(headline.every((game) => /已上线|公测|活跃|运营中/.test(`${game.release_status || ""} ${game.status || ""}`)));
});

test("separates released products, active research, and demo validation across the pipeline overview", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const verifiedReleases = await readFile(path.join(projectRoot, "app/verified-releases.ts"), "utf8");
  const validationGroup = dashboard.pipelineGroups.find((group) => group.name === "试玩验证样本");
  const researchGroups = dashboard.pipelineGroups.filter((group) => group.name !== "试玩验证样本");
  const researchNames = researchGroups.flatMap((group) => group.projects);
  const trackedNames = new Set(dashboard.pipelineGroups.flatMap((group) => group.projects));
  const releasedNames = ["Fields of Mistria", "Paralives", "Starsand Island", "BigWalk", "Aniimo", "王者万象棋", "塔塔冒险队", "小冰冰斗蛐蛐"];

  assert.equal(researchGroups.length, 7);
  assert.equal(new Set(researchNames).size, researchNames.length);
  assert.equal(dashboard.pipelineMeta.project_count, researchNames.length);
  assert.equal(dashboard.pipelineMeta.group_count, researchGroups.length);
  assert.ok(researchNames.every((name) => games.games.find((game) => game.name === name)?.lifecycle?.pipeline !== false));
  assert.ok(["Project63", "Dear Passengers"].every((name) => researchNames.includes(name)));
  assert.deepEqual(validationGroup?.projects, ["裂隙远征"]);
  assert.deepEqual(dashboard.pipelineGroups.find((group) => group.name === "其他厂商在研新品")?.projects, ["Witchbrook", "Spirit Crossing", "火人冲冲冲", "未眠野", "时之铃", "蓝色星原：旅谣", "Project63", "Dear Passengers"]);
  assert.deepEqual(dashboard.pipelineGroups.find((group) => group.name === "Pathea Games")?.projects, ["My Time at Evershine"]);
  assert.deepEqual(dashboard.pipelineGroups.find((group) => group.name === "字节（朝夕光年）")?.projects, ["集合！浆果镇", "代号：Team2"]);
  assert.ok(releasedNames.every((name) => !trackedNames.has(name)));
  assert.ok(releasedNames.every((name) => games.games.find((game) => game.name === name)?.lifecycle?.pipeline === false));
  assert.ok(releasedNames.every((name) => /已上线|活跃/.test(`${games.games.find((game) => game.name === name)?.release_status || ""} ${games.games.find((game) => game.name === name)?.status || ""}`)));
  assert.equal(games.games.find((game) => game.name === "裂隙远征")?.release_status, "试玩验证（Steam Demo）");
  assert.doesNotMatch(verifiedReleases, /"星绘友晴天":/);
  assert.match(verifiedReleases, /"小冰冰斗蛐蛐": \{[\s\S]*date: "2026-09-10", status: "已上线 · 不删档版本"/);
  assert.match(page, /pipelineEntries\.map\(studioPipelineName\)\.filter\(name => confirmedNames\.has\(name\)\)/);
  assert.match(page, /pipelineEntries\.filter\(entry => !confirmedNames\.has\(studioPipelineName\(entry\)\)\)/);

  assert.match(page, /const researchPipelineGroups = pipelineGroups\.filter/);
  assert.match(page, /const pipeline = allPipeline\.filter\(\(\[name\]\) => activePipelineNames\.has\(name\)\)/);
  assert.match(page, /direction\.projects\.filter\(\(name\) => activePipelineNames\.has\(name\)\)/);
  assert.match(page, /const vendorDirectionRows = researchPipelineGroups\.map/);
  assert.match(page, /studioScope === "总览" && <section className="pipeline-market-overview pipeline-observer-shell"/);
  assert.doesNotMatch(page, /<dt>厂商 \/ 分组<\/dt><dd>\{researchPipelineGroups\.length\}<\/dd>/);
  assert.doesNotMatch(page, /<dt>在研样本<\/dt><dd>\{pipeline\.length\}<\/dd>/);
  assert.doesNotMatch(page, /<dt>试玩验证样本<\/dt><dd>\{trialValidationCount\}<\/dd>/);
});

test("restores dense studio tracking fields and recent media signals", async () => {
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const pipelineIcons = JSON.parse(await readFile(path.join(projectRoot, "public/pipeline-icons.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  assert.equal(dashboard.domesticStudios.length, 7);
  assert.equal(Object.keys(dashboard.overseasStudios || {}).length, 15);
  assert.equal(Object.keys(dashboard.studioBios || {}).length, 21);
  assert.equal(dashboard.studioBios["腾讯"].article_count, 169);
  assert.equal(dashboard.studioBios["腾讯"].recent_articles.length, 5);
  assert.equal(dashboard.studioBios.Supercell.article_count, 4);
  assert.equal(dashboard.studioBios.Supercell.recent_articles.length, 4);
  assert.equal(dashboard.overseasStudios.Supercell.business_profile.revenue, "$3.01B");
  assert.equal(dashboard.overseasStudios.Supercell.business_profile.ebitda, "$1.06B");
  assert.equal(dashboard.overseasStudios.Supercell.business_profile.headcount, "约 928 人");
  assert.deepEqual(dashboard.overseasStudios.Supercell.business_profile.top_games, ["皇室战争", "荒野乱斗"]);
  const supercellHistory = dashboard.overseasStudios.Supercell.business_profile.financial_history;
  assert.deepEqual(supercellHistory.map((item) => item.year), ["2021", "2022", "2023", "2024", "2025"]);
  assert.deepEqual(supercellHistory.map((item) => item.revenue_eur_b), [1.89, 1.77, 1.7, 2.8, 2.65]);
  assert.deepEqual(supercellHistory.map((item) => item.ebitda_eur_b), [0.734, 0.632, 0.58, 0.876, 0.93]);
  assert.equal(supercellHistory.find((item) => item.year === "2024").basis, "不含递延");
  assert.ok(supercellHistory.every((item) => item.ebitda_eur_b < item.revenue_eur_b));
  assert.ok(supercellHistory.every((item) => /^https:\/\/supercell\.com\//.test(item.source_url)));
  const dashboardGameNames = new Set(dashboard.games.map((game) => game.name));
  assert.ok(dashboard.overseasStudios.Supercell.business_profile.top_games.every((name) => dashboardGameNames.has(name)));
  assert.equal(Object.keys(dashboard.overseasStudios).some((name) => /莉莉丝|Lilith/i.test(name)), false);
  assert.equal(dashboard.domesticStudios.some((studio) => studio.name === "莉莉丝"), true);
  assert.equal(Object.hasOwn(dashboard.studioBios, "莉莉丝(Lilith)"), false);
  for (const [name, studio] of Object.entries(dashboard.overseasStudios)) {
    assert.ok(studio.business_profile, `${name} should have a business profile`);
    assert.ok(studio.business_profile.fiscal_year, `${name} should identify its disclosure period`);
    assert.ok(studio.business_profile.revenue, `${name} should disclose revenue or explicitly mark it unavailable`);
    assert.ok(studio.business_profile.ebitda, `${name} should disclose profit or explicitly mark it unavailable`);
    assert.ok(studio.business_profile.headcount, `${name} should disclose headcount or explicitly mark it unavailable`);
    assert.match(studio.business_profile.source_url, /^https:\/\//, `${name} should link to a source`);
    assert.ok(studio.business_profile.top_games.every((gameName) => (studio.pool_games || []).includes(gameName)), `${name} top games should stay within that studio's dashboard sample scope`);
    assert.ok(dashboard.studioBios[name]?.recent_articles?.length > 0, `${name} should include at least one recent report`);
  }
  assert.doesNotMatch(page, /studio-summary-strip/);
  assert.doesNotMatch(page, /studio-article-count/);
  assert.doesNotMatch(page, /篇情报/);
  assert.match(page, /onOpenGame: \(game: Game\) => void/);
  assert.match(page, /onClick=\{\(\) => onOpenGame\(game\)\} aria-label=\{`查看\$\{product\}游戏详情`\}/);
  assert.match(page, /<StudioDetailPage[\s\S]*?onOpenGame=\{setSelected\}/);
  assert.match(page, /近期媒体情报/);
  assert.match(page, /studioTierLabel/);
  assert.doesNotMatch(page, /function StudioDigestCard/);
  assert.match(page, /studio-overseas-business/);
  assert.match(page, /热门游戏 · 仅看板收录/);
  assert.match(page, /business\.top_games/);
  assert.match(page, /function StudioDetailPage/);
  assert.match(page, /function StudioFinancialHistory/);
  assert.match(page, /近五年营收与 EBITDA/);
  assert.match(page, /口径提示/);
  assert.match(page, /business\.financial_history/);
  assert.doesNotMatch(page, /const overviewStudios = useMemo/);
  assert.doesNotMatch(page, /studio\.name !== "巨人"/);
  assert.doesNotMatch(page, /data\.overseasStudios\?\.Supercell/);
  assert.doesNotMatch(page, /studios=\{overviewStudios\}/);
  assert.match(page, /STUDIO INTELLIGENCE/);
  assert.match(page, /R&amp;D PIPELINE/);
  assert.match(page, /BUSINESS SIGNALS/);
  assert.match(page, /searchParams\.set\("studio", name\)/);
  assert.match(page, /studioNewsArticles/);
  for (const studio of dashboard.domesticStudios) {
    for (const rawName of studio.known_pipeline || []) {
      const name = rawName.replace(/（[^）]*）\s*$/, "").trim();
      assert.ok(pipelineIcons[name]?.path, `${studio.name} pipeline product ${name} should have an icon`);
    }
  }
});

test("shows Shan Hai Journey testing and team source details", async () => {
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const pipelineIcons = JSON.parse(await readFile(path.join(projectRoot, "public/pipeline-icons.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const shanhai = dashboard.pipelineDetails["山海奇旅"];

  assert.ok(shanhai.testing);
  assert.equal(shanhai.assessment.verdict.stance, "继续观察");
  assert.equal(shanhai.assessment.verdict.potential, "中");
  assert.equal(shanhai.assessment.verdict.readiness, "完成度偏低 · 首测技术验证");
  assert.equal(shanhai.assessment.source.label, "GRP 报告 #163");
  assert.match(shanhai.assessment.source.scope, /N=274/);
  assert.match(shanhai.analysis.social, /40 人/);
  assert.match(shanhai.analysis.social, /30 个固定露营车位/);
  assert.match(shanhai.analysis.readiness, /5–8 小时/);
  assert.equal(shanhai.media_reports[0].source, "GRP");
  assert.equal(shanhai.assessment.strengths.length, 3);
  assert.equal(shanhai.assessment.risks.length, 3);
  assert.equal(shanhai.assessment.changes_since_last_test.length, 3);
  assert.equal(shanhai.assessment.next_watch.length, 3);
  assert.match(page, /研发团队与成本情况/);
  assert.match(page, /核心团队成员/);
  assert.match(page, /研发周期与当前状态/);
  assert.match(page, /成本投入/);
  assert.match(page, /未披露字段标明核查状态/);
  assert.match(page, /《山海奇旅》项目组/);
  assert.match(page, /水滴事业部/);
  assert.match(page, /杭州（事业部口径；项目组办公地待确认）/);
  assert.match(page, /Zane Li Hai/);
  assert.match(page, /团队信息信源/);
  assert.match(page, /PlayStation Blog/);
  assert.match(page, /GamesRadar\+/);
  assert.match(page, /www\.ithome\.com\/0\/981\/528\.htm/);
  assert.equal(dashboard.pipelineDetails["代号：奇旅"], undefined);
  assert.ok(dashboard.pipelineGroups.find((group) => group.name === "网易")?.projects.includes("星绘友晴天"));
  assert.ok(dashboard.pipelineGroups.find((group) => group.name === "网易")?.projects.includes("雾海之下"));
  assert.equal(dashboard.pipelineGroups.find((group) => group.name === "网易")?.projects.includes("无限大"), false);
  assert.equal(dashboard.pipelineDetails["星绘友晴天"].stage, "PC 先行版上线验证 · 移动端待正式上线");
  assert.equal(dashboard.pipelineDetails["雾海之下"].testing.latest, "2026-08-17–23 大狩猎测试");
  assert.equal(dashboard.pipelineDetails["星绘友晴天"].category, "模拟经营类");
  assert.equal(dashboard.pipelineDetails["雾海之下"].category, "社交-多人合作类");
  assert.match(page, /Object\.entries\(data\.pipelineDetails \|\| \{\}\)/);
  assert.match(page, /category: knownGame\?\.category \|\| detail\.category/);
  assert.equal(dashboard.pipelineDetails["诡影藏锋"].platforms, "PC");
  assert.equal(dashboard.pipelineMeta.project_count, dashboard.pipelineGroups.filter((group) => group.name !== "试玩验证样本").flatMap((group) => group.projects).length);
  assert.equal(dashboard.pipelineMeta.structured_assessment_count, Object.keys(dashboard.pipelineDetails).length);
  assert.equal(pipelineIcons["代号：奇旅"], undefined);
  assert.equal(dashboard.pipelineGroups.some((group) => group.projects.includes("代号：奇旅")), false);
  assert.ok(shanhai.testing.records.some((record) => record.title.includes("代号：奇旅")));
  assert.equal(shanhai.testing.platforms, "PC / iOS / Android");
  assert.equal(shanhai.testing.records.length, 6);
  assert.ok(shanhai.gameplay_videos.some(video => video.milestone_date === "2024-08-21" && video.url.includes("BV1f6eueKEUR")));
  assert.equal(shanhai.gameplay_videos.find((video) => video.url.includes("BV15KTv6rEe3"))?.milestone_date, "2026-07-02");
  assert.equal(shanhai.gameplay_videos.find((video) => video.url.includes("L35NJQOH0526D7OK"))?.milestone_date, "2026-07-24");
  const lilliputVideos = dashboard.pipelineDetails["粒粒的小人国"].gameplay_videos;
  assert.equal(lilliputVideos.find((video) => video.title === "安家测试完整实机流程")?.milestone_date, "2026-03-19");
  assert.equal(lilliputVideos.find((video) => video.title === "安家测试玩家共创回顾片")?.milestone_date, "2026-03-30");
  const verifiedGameplay = {
    "诡影藏锋": ["BV1SAGN6fE5x", "BV1bju46UEFU"],
    "星绘友晴天": ["BV1oySTBuEzC"],
    "雾海之下": ["BV1JJMy62E5C"],
    "小冰冰斗蛐蛐": ["BV1i9u96ME4n"],
    "裂隙远征": ["BV1DmKm6TEMe"],
    "BigWalk": ["BV1GtuW6yEnt"],
    "代号：Team2": ["BV1KLjV6tEJV"],
  };
  for (const [name, bvids] of Object.entries(verifiedGameplay)) {
    const videos = dashboard.pipelineDetails[name].gameplay_videos;
    assert.ok(bvids.every((bvid) => videos.some((video) => video.url.includes(bvid))), `${name} should retain every verified gameplay video`);
    assert.ok(videos.every((video) => video.milestone_date), `${name} gameplay videos should be attached to timeline milestones`);
  }
  assert.equal(dashboard.pipelineDetails["诡影藏锋"].gameplay_videos[0].milestone_date, "2026-08-07");
  assert.equal(dashboard.pipelineDetails["星绘友晴天"].gameplay_videos[0].milestone_date, "2025-11-28");
  assert.equal(dashboard.pipelineDetails["雾海之下"].gameplay_videos[0].milestone_date, "2026-08-17");
  assert.equal(shanhai.testing.sourceUrl, "https://grp.woa.com/report.html?id=163");
  assert.match(page, /testingRecords/);
  assert.match(page, /pipelineMilestones\(selectedPipeline, selectedPipelineItem/);
  assert.doesNotMatch(page, /PipelineTestSection/);
  assert.match(page, /研发团队/);
  assert.match(page, /GRP 报告 #163/);
  assert.match(page, /StructuredProductAssessment/);
  assert.match(page, /结构化产品研判/);
  assert.match(page, /核心证据段/);
  assert.match(page, /查看原报告/);
  assert.match(page, /不足与待判断/);
  assert.match(page, /项目演变与本轮变化/);
  assert.match(page, /下一步观测/);
  assert.match(page, /ProjectProgressMedia/);
  assert.match(page, /项目进展与实机/);
  assert.match(page, /progress-media-timeline/);
  assert.equal((page.match(/<div className="progress-media-timeline/g) || []).length, 1);
  assert.match(page, /lifecycleLabel/);
  assert.match(page, /首次公开/);
  assert.match(page, /首次测试/);
  assert.match(page, /版号节点/);
  assert.doesNotMatch(page, /project-lifecycle-unified/);
  assert.doesNotMatch(page, /stagedNodes/);
  assert.doesNotMatch(page, /暂无可核验的公开记录/);
  assert.match(page, /condensedProgressNodes/);
  assert.match(page, /timelineRange/);
  assert.match(page, /item\.milestone_date \|\| item\.date/);
  assert.match(page, /\.slice\(0, 2\)/);
  assert.match(page, /progress-report-cover/);
  assert.match(page, /page-hero-detail/);
  assert.match(page, /!selectedPipeline/);
  const nextWatchIndex = page.indexOf('<section className="assessment-watch"');
  const assessmentSourceIndex = page.indexOf('className="assessment-source"');
  assert.ok(nextWatchIndex > -1 && nextWatchIndex < assessmentSourceIndex);
  const progressIndex = page.indexOf("<ProjectProgressMedia");
  const teamIndex = page.indexOf("<PipelineTeamSection", progressIndex);
  const assessmentIndex = page.indexOf("selectedAssessment ? <StructuredProductAssessment", teamIndex);
  const intelligenceIndex = page.indexOf("近期动态与信源", assessmentIndex);
  assert.ok(progressIndex > -1 && progressIndex < teamIndex);
  assert.ok(teamIndex < assessmentIndex && assessmentIndex < intelligenceIndex);
  assert.match(page, /pipelineEvidenceSections/);
  assert.match(page, /pipeline-evidence-grid-three/);
  assert.match(page, /title="内部报告"/);
  assert.match(page, /title="权威试玩"/);
  assert.match(page, /title="媒体报告"/);
  assert.equal(page.indexOf("<VideoGallery items={selectedPipelineItem.gameplay_videos}"), -1);
});

test("keeps pipeline test history complete and attaches every gameplay item", async () => {
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const details = dashboard.pipelineDetails;
  const timelineMedia = [
    "王者万象棋",
    "山海奇旅",
    "星布谷地",
    "崩坏：因缘精灵",
    "星绘友晴天",
    "生活派对",
    "塔塔冒险队",
    "Totally Mall",
    "Paralives",
    "Witchbrook",
    "Starsand Island",
    "Spirit Crossing",
  ];
  for (const name of timelineMedia) {
    assert.ok(details[name].gameplay_videos?.length, `${name} should retain gameplay evidence`);
    assert.ok(details[name].gameplay_videos.every((video) => video.milestone_date), `${name} gameplay evidence should have a milestone_date`);
  }

  assert.ok(details["王者万象棋"].testing.records.some((record) => record.title.includes("终测")));
  assert.ok(details["星布谷地"].testing.records.some((record) => record.title.includes("宜居")));
  assert.ok(details["崩坏：因缘精灵"].testing.records.some((record) => record.title.includes("结缘测试")));
  assert.ok(details["崩坏：因缘精灵"].testing.records.some((record) => record.title.includes("进化测试（二测）")));
  assert.ok(details["崩坏：因缘精灵"].testing.records.some((record) => record.date === "2025-09-17" && record.display_date === "2025.09.17–09.23"));
  assert.ok(details["崩坏：因缘精灵"].gameplay_videos.some((video) => video.milestone_date === "2025-09-17"));
  assert.ok(details["崩坏：因缘精灵"].gameplay_videos.some((video) => video.milestone_date === "2026-07-09"));
  assert.ok(details["星布谷地"].gameplay_videos.some((video) => video.milestone_date === "2025-11-10"));
  assert.ok(details["星布谷地"].gameplay_videos.some((video) => video.milestone_date === "2026-05-25"));
  assert.ok(details["星绘友晴天"].gameplay_videos.some((video) => video.milestone_date === "2026-02-28"));
  assert.ok(details["生活派对"].gameplay_videos.some((video) => video.milestone_date === "2024-06-06"));
  assert.equal(details["生活派对"].stage_date, "2024-12-14");
  assert.match(details["生活派对"].testing.status, /2024-12-14 停止服务/);
  assert.equal(details["塔塔冒险队"].gameplay_videos[0].milestone_date, "2026-06-23");
  assert.ok(details["塔塔冒险队"].gameplay_videos.some((video) => video.milestone_date === "2026-07-16"));
  assert.equal(details["塔塔冒险队"].gameplay_videos.find((video) => video.milestone_date === "2026-07-16")?.url, "https://www.bilibili.com/video/BV1kbKb6qEYq/");
  for (const name of ["Totally Mall", "Paralives", "Witchbrook", "Starsand Island", "Spirit Crossing"]) {
    assert.equal(details[name].gameplay_videos[0].evidence_kind, "report", `${name} store page should render as a report rather than a video`);
  }
  const sameCyclePhases = [
    ["粒粒的小人国", "2026-03-30", "first"],
    ["诡影藏锋", "2026-08-10", "first"],
    ["雾海之下", "2026-08-23", "first"],
    ["星布谷地", "2026-05-25", "retest"],
    ["崩坏：因缘精灵", "2025-09-20", "first"],
    ["崩坏：因缘精灵", "2026-06-22", "retest"],
    ["崩坏：因缘精灵", "2026-07-27", "retest"],
    ["塔塔冒险队", "2026-06-23", "prelaunch"],
  ];
  for (const [name, date, phase] of sameCyclePhases) {
    assert.equal(details[name].testing.records.find((record) => record.date === date)?.lifecycle_phase, phase, `${name} ${date} should stay in the same test-cycle node`);
  }
  const wanxiangGameplay = details["王者万象棋"].gameplay_videos;
  const expectedWanxiangGameplay = {
    BV1cV4y127Us: "2023-05-27",
    BV1ES421d7h7: "2024-04-01",
    BV135xFzPErv: "2025-10-30",
    BV17LBCB1EiX: "2025-12-25",
    BV1DTQfBVErR: "2026-03-24",
    BV1c7DqBPEHU: "2026-04-07",
  };
  for (const [bvid, milestoneDate] of Object.entries(expectedWanxiangGameplay)) {
    assert.equal(wanxiangGameplay.find((video) => video.url.includes(bvid))?.milestone_date, milestoneDate, `${bvid} should stay attached to its matching test milestone`);
  }
  assert.equal(details["王者万象棋"].gameplay_videos.find((video) => video.url.includes("BV1c7DqBPEHU"))?.milestone_date, "2026-04-07");

  const fieldsReports = details["Fields of Mistria"].media_reports || [];
  const fieldsReportKeys = fieldsReports.map((record) => `${record.date}|${record.url || record.title || ""}`);
  assert.equal(new Set(fieldsReportKeys).size, fieldsReportKeys.length, "identical source reports should not duplicate timeline cards");
});

test("keeps one chronological evidence timeline and skips unverified gaps", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  assert.match(page, /function lifecycleLabel/);
  assert.match(page, /project: "首次公开"/);
  assert.match(page, /first: "首次测试"/);
  assert.match(page, /return "二测"/);
  assert.match(page, /return "三测"/);
  assert.match(page, /return "复测"/);
  assert.match(page, /上线前测试/);
  assert.match(page, /license: "版号节点"/);
  assert.match(page, /release: "上线准备"/);
  assert.match(page, /launch: "正式上线"/);
  assert.doesNotMatch(page, /PIPELINE_LIFECYCLE_STAGES/);
  assert.doesNotMatch(page, /并行资质线/);
  assert.doesNotMatch(page, /暂无可核验的公开记录/);
  assert.match(page, /\.\.\.testingRecords,[\s\S]*\.\.\.reports/);
  assert.doesNotMatch(page, /name === "粒粒的小人国"/);
  assert.doesNotMatch(page, /important\.length \? important : dated\)\.slice\(-6\)/);
  assert.match(page, /const DASHBOARD_TIME_ZONE = "Asia\/Shanghai"/);
  assert.match(page, /function currentDateKey/);
  assert.match(page, /function shiftMonth/);
  assert.doesNotMatch(page, /DASHBOARD_AS_OF|SIX_MONTHS_START|RADAR_WINDOW_START/);
  const lifecycleSource = page.slice(page.indexOf("function lifecyclePhase"), page.indexOf("function lifecycleLabel"));
  assert.doesNotMatch(lifecycleSource, /recordText\(item, "summary"\)/, "future phases mentioned in summaries must not relabel the current milestone");
  assert.match(page, /return compacted\.sort\(\(a, b\) => a\.sortDate\.localeCompare\(b\.sortDate\)\)/);
  assert.match(page, /MERGEABLE_LIFECYCLE_PHASES = new Set\(\[\.\.\.TEST_LIFECYCLE_PHASES, "release"\]\)/);
  assert.match(page, /MERGEABLE_LIFECYCLE_PHASES\.has\(node\.phase\) \? timelineRange\(node\.items\)/);
  assert.match(page, /重新开服\|开服验证/);
  assert.ok(dashboard.pipelineDetails["王者万象棋"].testing.records.some((record) => record.date === "2026-09-10" && record.status === "confirmed" && record.verified_at === "2026-10-08" && record.url === "https://www.taptap.cn/app/243110"));
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.date === "2026-05-26")?.type, "版本验证");
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.date === "2026-06-08")?.type, "版本验证收官");
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.date === "2026-08-27")?.type, "上线准备");
  assert.ok(dashboard.pipelineDetails["塔塔冒险队"].testing.records.some((record) => record.date === "2026-09-04" && record.status === "planned"));
  const expectedVerifiedMilestones = {
    "粒粒的小人国": ["2025-09-24", "2026-03-24"],
    "王者万象棋": ["2022-11-12", "2023-02-10", "2023-05-27", "2024-04-01", "2025-07-15", "2025-10-30", "2025-12-25", "2026-02-12", "2026-02-26", "2026-03-24", "2026-05-25", "2026-05-26", "2026-06-08", "2026-07-28"],
    "山海奇旅": ["2025-03-20"],
    "诡影藏锋": ["2026-05-25", "2026-07-08"],
    "星绘友晴天": ["2025-06-13", "2025-09-24"],
    "星布谷地": ["2024-07-22", "2025-09-25"],
    "崩坏：因缘精灵": ["2025-08-28", "2025-09-24"],
    "生活派对": ["2022-04-08"],
    "塔塔冒险队": ["2026-02-26"],
    "小冰冰斗蛐蛐": ["2026-05-25", "2026-07-16"],
  };
  for (const [name, dates] of Object.entries(expectedVerifiedMilestones)) {
    const item = dashboard.pipelineDetails[name];
    const records = [...(item.testing?.records || []), ...(item.media_reports || [])];
    assert.ok(dates.every((date) => records.some((record) => record.date === date)), `${name} should retain every verified major milestone`);
  }
  assert.match(page, /const DATA_VERSION = "\d{8}-[^"]+"/);
  assert.match(dashboard.pipelineDetails["王者万象棋"].testing.status, /已上线.*全平台正式公测/);
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.date === "2024-04-01")?.display_date, "2024.04–2025.07");
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.date === "2026-07-28")?.lifecycle_phase, "experience");
  const xiaobingLaunch = dashboard.pipelineDetails["小冰冰斗蛐蛐"].testing.records.find((record) => record.type === "正式上线");
  assert.equal(xiaobingLaunch?.date, "2026-09-10");
  assert.equal(xiaobingLaunch?.observed_date, "2026-09-03");
  assert.equal(xiaobingLaunch?.status, "planned");
  assert.equal(dashboard.pipelineDetails["王者万象棋"].testing.records.find((record) => record.type === "正式上线")?.observed_date, "2026-09-03");
  assert.ok(dashboard.pipelineDetails["小冰冰斗蛐蛐"].testing.records.some((record) => record.date === "2026-08-10" && record.title.includes("不删档测试")));
  assert.equal(games.games.find((game) => game.name === "小冰冰斗蛐蛐")?.release_date, "2026-09-10");
});

test("adds sourced development teams for Tencent's popular released products", async () => {
  const profiles = JSON.parse(await readFile(path.join(projectRoot, "public/development-profiles.json"), "utf8"));
  assert.match(profiles["元梦之星"].team, /天美工作室群/);
  assert.match(profiles["舞力全开：派对"].team, /腾讯游戏 × 育碧/);
  assert.match(profiles["舞力全开：派对"].development_cycle, /五年多联合研发/);
  assert.match(profiles["金铲铲之战"].team, /光子工作室群/);
  assert.equal(profiles["金铲铲之战"].producer, "Vigil Yang");
  assert.ok(["元梦之星", "舞力全开：派对", "金铲铲之战"].every((name) => profiles[name].sources.length > 0));
  assert.ok(["元梦之星", "舞力全开：派对", "金铲铲之战"].flatMap((name) => profiles[name].sources).every((source) => source.url.startsWith("https://")));
});

test("restores the previous DataBrain coverage and local video covers", async () => {
  const snapshots = JSON.parse(await readFile(path.join(projectRoot, "public/databrain_snapshots.json"), "utf8"));
  const trends = JSON.parse(await readFile(path.join(projectRoot, "public/databrain_trends.json"), "utf8"));
  const videoCovers = JSON.parse(await readFile(path.join(projectRoot, "public/video-covers.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");

  assert.equal(snapshots.meta.games_with_metrics, 92);
  assert.equal(Object.keys(trends.games).length, 48);
  assert.ok(Object.values(videoCovers).filter((cover) => cover.path).length >= 60);
  assert.equal(Object.values(videoCovers).filter((cover) => cover.status === "video-unavailable").length, 0);
  assert.match(JSON.stringify(videoCovers), /BV12Ap2zjE5C/);
  assert.match(JSON.stringify(videoCovers), /BV1f6eueKEUR/);
  assert.match(JSON.stringify(videoCovers), /7nODHyw3lgs/);
  for (const bvid of ["BV1SAGN6fE5x", "BV1bju46UEFU", "BV1oySTBuEzC", "BV1JJMy62E5C", "BV1i9u96ME4n", "BV1DmKm6TEMe", "BV1GtuW6yEnt", "BV1KLjV6tEJV"]) {
    assert.equal(videoCovers[bvid]?.status, "ready", `${bvid} should have a ready local cover`);
    await access(path.join(projectRoot, "public", videoCovers[bvid].path.replace(/^\//, "")));
  }
  assert.match(page, /databrain_snapshots\.json/);
  assert.match(page, /video-covers\.json/);
  assert.match(page, /videoSearchUrl/);
  assert.match(page, /mediaCoverKey/);
  assert.match(page, /replacement_note/);
  assert.match(page, /function evidenceKind/);
  assert.match(page, /evidence_kind: evidenceKind\(item\)/);
  assert.match(page, /entry\.evidence_kind === "video" \? "playtest" : "report"/);

  const webpageCovers = [
    "https://news.17173.com/content/04022026/154658695.shtml",
    "https://www.163.com/dy/article/L35NJQOH0526D7OK.html",
    "https://play.google.com/store/apps/details?id=com.farlightgames.spark.gp",
    "https://store.steampowered.com/app/1118520/Paralives/",
    "https://store.steampowered.com/app/1846700/Witchbrook/",
    "https://store.steampowered.com/app/2966320/Starsand_Island/",
    "https://store.steampowered.com/app/2321960/Spirit_Crossing/",
  ];
  assert.ok(webpageCovers.every((url) => videoCovers[url]?.status === "ready"));
  for (const url of webpageCovers) {
    await access(path.join(projectRoot, "public", videoCovers[url].path.replace(/^\//, "")));
  }

  for (const key of ["BV1ES421d7h7", "BV135xFzPErv", "BV1jbkkBXEYt", "BV15up4zrEr3", "BV1rm421N7Cm", "BV1kbKb6qEYq", "https://game.xiaomi.com/gameVideo/62413491"]) {
    assert.equal(videoCovers[key]?.status, "ready", `${key} should have a ready local cover`);
    await access(path.join(projectRoot, "public", videoCovers[key].path.replace(/^\//, "")));
  }

  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  assert.equal(dashboard.pipelineDetails["Starsand Island"].gameplay_videos[0].url, "https://store.steampowered.com/app/2966320/Starsand_Island/");
  assert.equal(dashboard.pipelineDetails["Spirit Crossing"].gameplay_videos[0].url, "https://store.steampowered.com/app/2321960/Spirit_Crossing/");

  const sampleCover = Object.values(videoCovers).find((cover) => cover.path);
  assert.ok(sampleCover?.path);
  await access(path.join(projectRoot, "public", sampleCover.path.replace(/^\//, "")));
});

test("fills previously blank PC product details with platform-correct metrics", async () => {
  const pcMetrics = JSON.parse(await readFile(path.join(projectRoot, "public/pc-metrics.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const entries = Object.entries(pcMetrics.games);
  const operatingCoverage = entries.filter(([, metric]) => [metric.average_ccu, metric.peak_ccu, metric.revenue_30d, metric.sales_units].some(value => typeof value === "number" && Number.isFinite(value)));

  assert.equal(entries.length, 59);
  assert.equal(operatingCoverage.length, 56);
  assert.ok(entries.every(([, metric]) => /^https:\/\//.test(metric.source_url)));
  assert.ok(entries.every(([, metric]) => /^2026-\d{2}-\d{2}$/.test(metric.data_date)));
  assert.ok(entries.filter(([name]) => name !== "Dressmaker").every(([, metric]) => metric.data_date <= "2026-09-14"));
  const dressmaker = pcMetrics.games.Dressmaker;
  assert.ok(dressmaker.data_date >= "2026-09-30");
  assert.equal(dressmaker.field_sources.average_ccu.date, dressmaker.data_date);
  assert.equal(dressmaker.field_sources.reviews_count.date, dressmaker.data_date);
  assert.ok(dressmaker.average_ccu > 0);
  assert.ok(dressmaker.peak_ccu >= dressmaker.average_ccu);
  assert.equal(pcMetrics.games.PEAK.average_ccu, 36493);
  assert.equal(pcMetrics.games.PEAK.revenue_30d, 4534145);
  assert.equal(pcMetrics.games["珊瑚岛"].review_score, 89);
  assert.equal(pcMetrics.games["Town of Salem 2"].confidence, "官方商店");
  assert.equal(pcMetrics.games["逃跑吧！少年"].confidence, "暂无可用数据");
  assert.equal(pcMetrics.games["Among Us"].average_ccu, 8395);
  assert.equal(pcMetrics.games["R.E.P.O."].revenue_30d, 2897120);
  assert.equal(pcMetrics.games["幻兽帕鲁"].peak_ccu, 625296);
  assert.equal(pcMetrics.games["云顶之弈"].confidence, "暂无可用数据");
  assert.match(page, /pc-metrics\.json/);
  assert.match(
    page,
    /monthly_revenue: metrics\.monthly_revenue \?\? metrics\.revenue_monthly/,
    "legacy PC revenue aliases should be normalized before rendering",
  );
  assert.match(page, /近 30 日 ACU/);
  assert.match(page, /峰值 CCU/);
  assert.match(page, /<b>PC \/ Steam<\/b>/);
  assert.match(page, /<span>近 30 日收入<\/span>/);
  assert.match(page, /Steam 口碑/);
  assert.match(page, /selectedPcTrendMismatch/);
  assert.match(page, /原日级趋势与最新 PC 快照的口径或数量级不一致/);
  assert.match(page, /移动端与 PC \/ Steam 指标按平台分别展示/);
});

test("keeps popular-game version events visible in category recent activity", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  assert.match(page, /const visibleEvents = insight\.recentEvents;/);
  assert.doesNotMatch(page, /recentEvents\.filter\(event => !\(event\.productType === "热门游戏"/);
});

test("renders Heartopia mobile and Steam metrics as separate platform groups", async () => {
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const pcMetrics = JSON.parse(await readFile(path.join(projectRoot, "public/pc-metrics.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const heartopia = games.games.find((game) => game.name === "心动小镇");

  assert.equal(heartopia.metrics.platform, "mobile");
  assert.equal(heartopia.metrics.dau, 912751);
  assert.equal(heartopia.metrics.mau, 5007600);
  assert.equal(heartopia.metrics.monthly_revenue, 11059022);
  assert.ok(pcMetrics.games["心动小镇"]);
  assert.match(page, /selectedMobileMetrics/);
  assert.match(page, /platform-metrics-stack/);
  assert.match(page, /<b>移动端<\/b>/);
  assert.match(page, /<b>PC \/ Steam<\/b>/);
  assert.match(page, /<b>主机端<\/b>/);
  assert.match(page, /移动端与 PC \/ Steam 指标按平台分别展示/);
  assert.doesNotMatch(page, /PC \/ Steam 补充/);
  assert.doesNotMatch(page, /className="pool green">\{selected\.pool\}/);
});

test("does not let empty dashboard metrics erase enriched mobile metrics", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");

  assert.match(page, /function hasMetricPayload\(value: unknown\)/);
  assert.match(page, /hasMetricPayload\(detail\.metrics\) \? detail\.metrics : hasMetricPayload\(game\.metrics\) \? game\.metrics : snapshot\.metrics/);
});

test("merges released-product updates into three intelligence columns", async () => {
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const games = JSON.parse(await readFile(path.join(projectRoot, "public/games.json"), "utf8"));
  const dreamstar = games.games.find((game) => game.name === "元梦之星");

  assert.match(page, /function ProductIntelligenceBoard/);
  assert.match(page, /product-intelligence-columns/);
  assert.match(page, /重大版本更新/);
  assert.match(page, /玩法更新/);
  assert.match(page, /权威媒体报告/);
  assert.match(page, /selectedIsReleased \? <ProductIntelligenceBoard game=\{selected\}/);
  assert.match(page, /运营更新近半年 · 报告取最新 · 按事件性质归类/);
  assert.match(page, /PATCH_LEVEL_UPDATE_PATTERN/);
  assert.match(page, /AUTHORITATIVE_REPORT_SOURCE_PATTERN/);
  assert.match(page, /MINOR_CONTENT_PATTERN/);
  assert.match(page, /consumedArticles/);
  assert.match(page, /function gameplayFeatureEntry/);
  assert.match(page, /function versionFocusedEntry/);
  assert.match(page, /新增玩法另见“玩法更新”栏目/);
  assert.match(page, /与对应版本更新共用同一信源/);
  assert.match(page, /gameplay_video_url/);
  assert.match(page, /查找相关实机/);
  assert.match(page, /实机：/);
  assert.match(page, /relatedEntry\.url \|\| baseEntry\.url/);
  assert.match(page, /Demo \/ 实机视频/);
  assert.match(page, /放置模拟经营/);
  assert.match(page, /离线\(\?:自动\)\?经营/);
  assert.ok(dreamstar, "元梦之星 should remain in the released-product dataset");
  assert.equal(dreamstar.intelligence.recent_updates.length, 1);
  assert.equal(dreamstar.intelligence.recent_updates[0].version, "星宝农场小岛");
  assert.match(dreamstar.intelligence.recent_updates[0].summary, /放置模拟经营/);
  assert.equal(dreamstar.intelligence.recent_updates[0].source, "《元梦之星》官网");
});

test("enriches every pipeline product with structured, sourced research", async () => {
  const dashboard = JSON.parse(await readFile(path.join(projectRoot, "public/dashboard_data.json"), "utf8"));
  const page = await readFile(path.join(projectRoot, "app/page.tsx"), "utf8");
  const projects = Object.entries(dashboard.pipelineDetails);
  const allowedStances = new Set(["看好", "谨慎看好", "继续观察", "谨慎", "不看好"]);
  const allowedPotential = new Set(["高", "中高", "中", "中低", "低", "待判断"]);

  assert.equal(dashboard.pipelineMeta.structured_assessment_count, projects.length);
  assert.equal(projects.filter(([, item]) => item.assessment).length, projects.length);
  assert.deepEqual(dashboard.pipelineMeta.grp_reports, [76, 131, 145, 158, 163, 169, 164, 171, 64, 74, 63, 153]);

  for (const [name, item] of projects) {
    const assessment = item.assessment;
    assert.ok(assessment, `${name} should have a structured assessment`);
    assert.ok(allowedStances.has(assessment.verdict.stance), `${name} has an invalid stance`);
    assert.ok(allowedPotential.has(assessment.verdict.potential), `${name} has an invalid potential`);
    assert.ok(assessment.verdict.summary.length >= 30, `${name} needs a substantive verdict`);
    assert.ok(assessment.strengths.length >= 2, `${name} needs sourced strengths`);
    assert.ok(assessment.risks.length >= 2, `${name} needs sourced risks`);
    assert.ok(assessment.changes_since_last_test.length >= 1, `${name} needs a change record`);
    assert.ok(assessment.next_watch.length >= 2, `${name} needs next-watch questions`);
    assert.match(assessment.source.url, /^https?:\/\//, `${name} needs a source URL`);
  }

  const grpSources = {
    "星绘友晴天": 76,
    "星布谷地": 131,
    "代号：Team2": 145,
    "崩坏：因缘精灵": 158,
    "山海奇旅": 163,
    "诡影藏锋": 169,
  };
  for (const [name, reportId] of Object.entries(grpSources)) {
    assert.match(dashboard.pipelineDetails[name].assessment.source.label, new RegExp(`^GRP 报告 #${reportId}(?:$| \\+)`));
    assert.equal(dashboard.pipelineDetails[name].assessment.source.url, `https://grp.woa.com/report.html?id=${reportId}`);
  }

  assert.match(dashboard.pipelineDetails["粒粒的小人国"].stage, /9-22 开测/);
  assert.match(dashboard.pipelineDetails["塔塔冒险队"].stage, /9-04 公测/);
  assert.match(dashboard.pipelineDetails.BigWalk.stage, /正式上线/);
  assert.match(dashboard.pipelineDetails["Starsand Island"].stage, /1\.0 正式上线/);
  assert.match(dashboard.pipelineDetails["Spirit Crossing"].stage, /公开 Playtest/);
  assert.match(dashboard.pipelineDetails["裂隙远征"].stage, /89% 好评/);
  assert.match(page, /天谕工作室《诡影藏锋》项目组/);
  assert.match(page, /studio: "SGRA 银之心工作室（腾讯北极光工作室群旗下）", company: "腾讯"/);
  assert.match(page, /organization: "腾讯北极光工作室群 · SGRA 银之心工作室"/);
  assert.match(page, /约 160 人（2025 年口径）/);
  assert.match(page, /500 人以上（2026 年口径/);
  assert.match(page, /Glow Studio《代号：Team2》项目组/);
  assert.doesNotMatch(page, /· STUDIO/);
});
