"use client";

import { isMobileMetricScope } from "./mobile-metric-scope";
import { publicAssetUrl } from "./public-asset-url";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { evaluateMetricSeries, type MetricSignal } from "./metric-anomalies";
import { anomalyAttribution, ATTRIBUTION_REVIEW_DATE } from "./anomaly-attributions";
import supplementalIcons from "../public/supplemental-icons.json";
import { resolveGameIconPath } from "./game-icon-path";
import intakeData from "../public/game-intake.json";
import { mergeMetricMaps } from "./pc-metrics";
import supplementalTrends from "../public/supplemental-trends.json";
import { categoryIntakes, type IntakeRecord } from "./game-intake";
import { verifiedReleases } from "./verified-releases";
import { buildTrendEvents, type TrendEvent } from "./trend-events";
const gameIntakes: Record<string, IntakeRecord> = intakeData;

type Tab = "games" | "pipeline";
type OverviewView = "categories" | "ranking";
type RankingMetric = "mobile_dau" | "pc_acu";
const PRODUCT_PAGE_SIZE = 20;
type DevelopmentProfileSource = {
  label: string;
  url: string;
  note?: string;
};
type DevelopmentProfile = {
  company?: string;
  team?: string;
  team_note?: string;
  early_team_size?: string;
  producer?: string;
  development_cycle?: string;
  prior_experience?: string;
  confidence?: string;
  coverage_level?: "深度档案" | "基础归属" | "待核验";
  sources?: DevelopmentProfileSource[];
};
type Game = Record<string, any> & { name: string; category?: string; pool?: string; development_profile?: DevelopmentProfile; pipeline_team?: PipelineTeamProfile };
type PipelineGroup = { name: string; track_focus?: string; projects: string[] };
type StudioRecord = {
  name: string;
  track_focus?: string;
  reason?: string;
  known_published?: string[];
  known_pipeline?: string[];
  pool_games?: string[];
  tier?: string;
  business_profile?: {
    fiscal_year: string;
    revenue: string;
    revenue_note?: string;
    ebitda: string;
    ebitda_note?: string;
    headcount: string;
    headcount_note?: string;
    monthly_active_users?: string;
    top_games: string[];
    source_label: string;
    source_url: string;
    financial_history?: Array<{
      year: string;
      revenue_eur_b: number;
      ebitda_eur_b: number;
      basis?: string;
      source_label: string;
      source_url: string;
    }>;
  };
};
type StudioArticle = {
  title?: string;
  date?: string;
  source?: string;
  type?: string;
  summary?: string;
  url?: string;
  games_mentioned?: string[];
};
type StudioBio = {
  article_count?: number;
  summary?: string;
  recent_articles?: StudioArticle[];
};
type PcMetric = {
  average_ccu: number | null;
  peak_ccu: number | null;
  historical_peak_ccu?: number | null;
  revenue_30d: number | null;
  lifetime_revenue_estimates?: { min: number; max: number; currency: "USD" };
  sales_units: number | null;
  reviews_count: number | null;
  reviews_count_approximate?: boolean;
  review_score: number | null;
  review_score_range?: [number, number];
  data_date: string;
  source: string;
  source_url: string;
  confidence: "第三方估算" | "第三方统计" | "官方商店" | "暂无可用数据";
  note?: string;
  owner_estimates?: { min: number; max: number; checked_on: string; source_url: string; providers: Array<{name: string; value: number}> };
  field_sources?: Record<string, { date: string; url: string }>;
};
type AssessmentFinding = {
  module: string;
  title: string;
  judgement: string;
  status?: string;
  evidence_refs?: string[];
};
type AssessmentChange = {
  module: string;
  direction: "明显改善" | "小幅改善" | "首次验证" | "基本不变" | "出现退步" | "方向重构" | "新增但未闭环";
  title: string;
  detail: string;
};
type AssessmentWatch = {
  module: string;
  question: string;
  trigger: string;
};
type StructuredAssessment = {
  as_of: string;
  source?: {
    label: string;
    title: string;
    author?: string;
    report_date?: string;
    scope?: string;
    url?: string;
  };
  verdict: {
    stance: "看好" | "谨慎看好" | "继续观察" | "不看好";
    potential: "高" | "中高" | "中" | "中低" | "低" | "待判断";
    readiness: string;
    confidence: "高" | "中" | "低";
    summary: string;
  };
  strengths: AssessmentFinding[];
  risks: AssessmentFinding[];
  changes_since_last_test: AssessmentChange[];
  next_watch: AssessmentWatch[];
};
type DashboardData = {
  games: Game[];
  pcMetrics?: Record<string, PcMetric>;
  pcTrends?: Record<string, any>;
  databrainEvents?: Record<string, any[]>;
  databrainResearch?: Record<string, Array<Record<string, unknown>>>;
  trendMeta?: Record<string, any>;
  videoCovers?: Record<string, string>;
  videoCoverStatus?: Record<string, string>;
  categoryMeta: Record<string, { icon?: string; desc?: string; group?: string; color?: string }>;
  pipelineDetails: Record<string, any>;
  pipelineIcons: Record<string, { path?: string; pageUrl?: string; source?: string }>;
  pipelineGroups: PipelineGroup[];
  domesticStudios: StudioRecord[];
  overseasStudios: Record<string, StudioRecord>;
  studioBios?: Record<string, StudioBio>;
};
type YouyansuoItem = {
  name: string;
  published_date: string;
  evidence_title: string;
  source_url: string;
  summary: string;
  identity_status: string;
  scope_status: string;
  category: string[];
  disposition: string;
};
type YouyansuoDiscovery = {
  meta: { scan_date: string; status: string; candidates: number; tracked_updates: number };
  candidates: YouyansuoItem[];
  tracked_updates: YouyansuoItem[];
};

const EMPTY: DashboardData = {
  games: [],
  pcMetrics: {},
  databrainEvents: {},
  databrainResearch: {},
  trendMeta: {},
  videoCovers: {},
  videoCoverStatus: {},
  categoryMeta: {},
  pipelineDetails: {},
  pipelineIcons: {},
  pipelineGroups: [],
  domesticStudios: [],
  overseasStudios: {},
  studioBios: {},
};

function isStructuredAssessment(value: unknown): value is StructuredAssessment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StructuredAssessment>;
  return Boolean(candidate.verdict && typeof candidate.verdict.summary === "string" && Array.isArray(candidate.strengths) && Array.isArray(candidate.risks) && Array.isArray(candidate.changes_since_last_test) && Array.isArray(candidate.next_watch));
}

const tabs: Array<{ id: Tab; label: string; kicker: string }> = [
  { id: "games", label: "品类总览", kicker: "RESEARCH OVERVIEW" },
  { id: "pipeline", label: "厂商总览", kicker: "STUDIO OVERVIEW" },
];

const PIPELINE_CATEGORIES: Array<{ id: string; color: string; label: string; shortLabel: string; projects: string[]; signal: string; representative: string }> = [
  {
    id: "simulation",
    color: "#356fef",
    label: "模拟经营类",
    shortLabel: "模拟经营类",
    projects: ["粒粒的小人国", "山海奇旅", "星绘友晴天", "星布谷地", "Totally Mall", "Fields of Mistria", "Paralives", "Witchbrook", "Starsand Island", "Spirit Crossing", "集合！浆果镇", "My Time at Evershine", "奇遇动物城", "Dressmaker"],
    signal: "覆盖生活建造、社区经营与融合经营，供给最为密集",
    representative: "粒粒的小人国 / 星布谷地",
  },
  {
    id: "autochess",
    color: "#245680",
    label: "自走棋",
    shortLabel: "自走棋",
    projects: ["妖妖棋", "王者万象棋", "小冰冰斗蛐蛐", "裂隙远征", "代号：Team2", "火人冲冲冲", "时之铃"],
    signal: "围绕阵容构筑与自动战斗，多款进入测试或上线验证",
    representative: "王者万象棋 / 小冰冰斗蛐蛐",
  },
  {
    id: "creature",
    color: "#b45f4b",
    label: "捉宠类",
    shortLabel: "捉宠类",
    projects: ["崩坏：因缘精灵", "塔塔冒险队", "Aniimo", "蓝色星原：旅谣"],
    signal: "均以宠物捕捉、收集和养成为核心驱动",
    representative: "崩坏：因缘精灵 / 塔塔冒险队",
  },
  {
    id: "multiplayer",
    color: "#2e8294",
    label: "多人合作类",
    shortLabel: "多人合作类",
    projects: ["雾海之下", "诡影藏锋", "生活派对", "BigWalk", "未眠野", "源初之结", "Project63", "Dear Passengers"],
    signal: "覆盖组队协作、多人任务和派对互动，仍以测试验证为主",
    representative: "雾海之下 / 诡影藏锋",
  },
] as const;

const PIPELINE_MATRIX_STAGES = [
  { id: "project", label: "首曝", index: "01" },
  { id: "first", label: "一测", index: "02" },
  { id: "second", label: "二测", index: "03" },
  { id: "third", label: "终测", index: "04" },
  { id: "launch", label: "上线", index: "05" },
] as const;
const PIPELINE_MATRIX_CATEGORIES = PIPELINE_CATEGORIES;
function pipelineCategoryFor(name: string) {
  const group = PIPELINE_CATEGORIES.find((category) => category.projects.includes(name));
  return group?.id === "multiplayer" ? "社交-多人合作类" : group?.label;
}
type PipelineMatrixStage = typeof PIPELINE_MATRIX_STAGES[number]["id"];
type PipelineMatrixEntry = {
  name: string;
  stage: PipelineMatrixStage;
  stageLabel: string;
  date: string;
  planned: boolean;
  target?: "pipeline" | "game";
  recentUpdateDate?: string;
  game: Game;
};
type PipelineMatrixRow = {
  id: string;
  label: string;
  color: string;
  entries: PipelineMatrixEntry[];
};
type RecentLaunchEntry = {
  name: string;
  date: string;
  label: string;
  title: string;
  planned: boolean;
  target: "game" | "pipeline";
  game: Game;
};
// Keep the preview from reusing a stale JSON response after an icon refresh.
// Bump this value whenever the static data bundle is regenerated.
const DATA_VERSION = "20261008-reveal-media-1";

const PIPELINE_STATUS_PATTERN = /在研|研发|测试|首测|二测|内测|删档|不删档|冒泡|预约|未上线|Early Access|\bEA\b|试玩|上线前|上线验证|公测预约/u;
const PIPELINE_VALIDATION_GROUP = "试玩验证样本";

function pipelineGroupNameSet(groups: PipelineGroup[], includeValidation: boolean, fallbackNames: string[] = []) {
  if (!groups.length) return new Set(fallbackNames);
  return new Set(groups
    .filter((group) => includeValidation || group.name !== PIPELINE_VALIDATION_GROUP)
    .flatMap((group) => group.projects));
}

function isHeadlineProduct(game: Game, pipelineNames: Set<string>) {
  if (game.alias_of) return false;
  if (verifiedReleases[game.name]?.date <= currentDateKey()) return true;
  const lifecycle = game.lifecycle && typeof game.lifecycle === "object" ? game.lifecycle as Record<string, unknown> : {};
  const statusText = `${game.release_status || ""} ${game.status || ""} ${lifecycle.stage || ""} ${lifecycle.reason || ""}`;
  if (pipelineNames.has(game.name)) return false;
  if (lifecycle.pipeline === true) return false;
  if (lifecycle.pipeline === false && /已上线|活跃|运营中/.test(statusText)) return true;
  if (PIPELINE_STATUS_PATTERN.test(statusText)) return false;
  return /已上线|公测|活跃|运营中/.test(statusText);
}

function productPlatformText(game: Game) {
  return String(game.platform || (Array.isArray(game.platforms) ? game.platforms.join(" / ") : game.platforms) || game.metrics?.platform || "");
}

function numericMetric(value: unknown) {
  const number = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(number) || number < 0 ? null : number;
}

function mobileDau(game: Game) {
  const hasMobilePlatform = /移动|iOS|Android|小游戏|mobile/i.test(productPlatformText(game));
  return hasMobilePlatform ? numericMetric(game.metrics?.dau) : null;
}

function pcAcu(game: Game, metrics: Record<string, PcMetric>) {
  return numericMetric(metrics[game.name]?.average_ccu);
}

function attachReleasedDevelopmentProfiles(games: Game[], pipelineNames: Set<string>, curatedProfiles: Record<string, DevelopmentProfile>) {
  return games.map((game) => {
    if (!isHeadlineProduct(game, pipelineNames)) return game;
    const curated = curatedProfiles[game.name];
    if (curated) return { ...game, development_profile: curated };
    if (game.development_profile) return game;
    const developer = game.developer || game.profile?.developer;
    return {
      ...game,
      development_profile: {
        company: developer || "待核验",
        team: developer ? `${developer}（基础资料标注，待核验）` : "公开开发主体待核验",
        team_note: "该产品尚未进入研发归属资料表；请勿据此推断具体项目组、工作室、负责人或团队规模",
        early_team_size: "未公开",
        producer: "未公开",
        development_cycle: "未公开",
        prior_experience: "未公开",
        confidence: "待核验",
        coverage_level: "待核验",
      },
    };
  });
}

function compact(value?: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function money(value?: number) {
  if (!value) return "—";
  return "$" + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function metricCount(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function metricMoney(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return "$" + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function shortDate(value?: string) {
  if (!value) return "待确认";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${year}.${month}.${day}` : String(value);
}

const VIDEO_THUMBNAILS: Record<string, string> = {
  BV1CVjE6PEne: "/video-thumbnails/eggy-season.jpg",
  BV1WkRABXEiX: "/video-thumbnails/eggy-guide.jpg",
  BV1vYdLB3EMt: "/video-thumbnails/eggy-skins.jpg",
  BV11FXoBPE9F: "/video-thumbnails/liliput-recap.jpg",
  BV1ufAGzGEz1: "/video-thumbnails/liliput-gameplay.jpg",
};

function videoThumbnail(url = "", thumbnailMap: Record<string, string> = VIDEO_THUMBNAILS) {
  if (thumbnailMap[url]) return thumbnailMap[url];
  const bilibili = url.match(/(BV[\w]+)/i)?.[1];
  if (bilibili && thumbnailMap[bilibili]) return thumbnailMap[bilibili];
  const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/i)?.[1];
  return youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : "";
}

function videoId(url = "") {
  return url.match(/(BV[\w]+)/i)?.[1] || url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/i)?.[1] || "";
}

function mediaCoverKey(url = "") {
  return videoId(url) || url;
}

function videoSearchUrl(item: Record<string, string>) {
  const query = item.title || item.platform || "游戏实机视频";
  if (/bilibili\.com/i.test(item.url || "")) return `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
  if (/youtube\.com|youtu\.be/i.test(item.url || "")) return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return item.url || "#";
}

function normalizeMetrics(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const metrics = value as Record<string, unknown>;
  return {
    ...metrics,
    monthly_revenue: metrics.monthly_revenue ?? metrics.revenue_monthly,
    data_date: metrics.data_date ?? metrics.updated,
    source: metrics.source ?? metrics.data_source,
  };
}

function hasMetricPayload(value: unknown) {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length);
}

function mergeGames(enriched: Game[], rich: Game[], trends: Record<string, any> = {}, trends90d: Record<string, any> = {}, snapshots: Record<string, any> = {}, latestMobileMetrics: Record<string, any> = {}) {
  const richMap = new Map(rich.map((game) => [game.name, game]));
  return enriched.map((game) => {
    const detail = (richMap.get(game.name) || {}) as Game;
    const snapshot = snapshots[game.name] || {};
    return {
      ...game,
      ...detail,
      profile: { ...(game.profile || {}), ...(detail.profile || {}) },
      intelligence: { ...(game.intelligence || {}), ...(detail.intelligence || {}) },
      metrics: normalizeMetrics(hasMetricPayload(latestMobileMetrics[game.name]) ? latestMobileMetrics[game.name] : hasMetricPayload(detail.metrics) ? detail.metrics : hasMetricPayload(game.metrics) ? game.metrics : snapshot.metrics),
      data_coverage: detail.data_coverage || game.data_coverage || snapshot.data_coverage,
      databrain_url: detail.databrain_url || game.databrain_url || snapshot.databrain_url,
      metrics_trend_30d: trends90d[game.name] || trends[game.name] || (supplementalTrends as Record<string, unknown>)[game.name] || detail.metrics_trend_30d || game.metrics_trend_30d,
    };
  });
}

function MiniTrend({ values = [] }: { values?: Array<{ value: number }> }) {
  const slice = values.slice(-14);
  const max = Math.max(...slice.map((item) => item.value), 1);
  return (
    <div className="mini-trend" aria-label="最近趋势">
      {slice.map((item, index) => (
        <i key={index} style={{ height: `${Math.max(12, (item.value / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function LineChart({ title, subtitle, points = [], format = compact, accent = "#356fef", granularity = "daily", events = [] }: { title: string; subtitle: string; points?: Array<{ date: string; value: number }>; format?: (value?: number) => string; accent?: string; granularity?: "daily" | "weekly"; events?: TrendEvent[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null);
  const [rangeStartIndex, setRangeStartIndex] = useState(0);
  const seriesKey = `${points.length}:${points[0]?.date || ""}:${points[points.length - 1]?.date || ""}`;
  useEffect(() => {
    setRangeStartIndex(0);
    setActiveIndex(null);
    setActiveEventIndex(null);
  }, [seriesKey]);
  if (!points.length) return null;
  const maxStartIndex = Math.max(0, points.length - 2);
  const safeStartIndex = Math.min(rangeStartIndex, maxStartIndex);
  const visiblePoints = points.slice(safeStartIndex);
  const width = 620;
  const height = 190;
  const padX = 18;
  const padY = 22;
  const values = visiblePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const coords = visiblePoints.map((point, index) => ({
    x: padX + (index / Math.max(visiblePoints.length - 1, 1)) * (width - padX * 2),
    y: padY + ((max - point.value) / range) * (height - padY * 2),
  }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const latest = visiblePoints[visiblePoints.length - 1];
  const first = visiblePoints[0];
  const delta = first.value ? ((latest.value - first.value) / first.value) * 100 : 0;
  const resolvedActiveIndex = activeIndex === null ? null : Math.min(activeIndex, visiblePoints.length - 1);
  const activePoint = resolvedActiveIndex === null ? null : visiblePoints[resolvedActiveIndex];
  const activeCoord = resolvedActiveIndex === null ? null : coords[resolvedActiveIndex];
  const tooltipEdge = resolvedActiveIndex !== null && resolvedActiveIndex <= 2 ? "start" : resolvedActiveIndex !== null && resolvedActiveIndex >= visiblePoints.length - 3 ? "end" : "center";
  const rangeProgress = maxStartIndex ? safeStartIndex / maxStartIndex * 100 : 0;
  const eventMarkers = events.reduce<Array<{ index: number; events: TrendEvent[] }>>((markers, event) => {
    const index = visiblePoints.findIndex((point) => String(point.date).slice(0, 10) === event.date);
    if (index < 0) return markers;
    const marker = markers.find((candidate) => candidate.index === index);
    if (marker) marker.events.push(event);
    else markers.push({ index, events: [event] });
    return markers;
  }, []);
  const eventMarkerLanes = eventMarkers.reduce<number[]>((lanes, marker, markerIndex) => {
    const lane = [0, 1, 2, 3].find((candidate) => lanes.every((usedLane, previousIndex) => usedLane !== candidate || Math.abs(coords[eventMarkers[previousIndex].index].x - coords[marker.index].x) >= 185));
    lanes.push(lane ?? markerIndex % 4);
    return lanes;
  }, []);
  const activeEventMarker = activeEventIndex === null ? null : eventMarkers[activeEventIndex] || null;
  const activeEvent = activeEventMarker?.events[0] || null;
  const selectNearestPoint = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const ratio = Math.max(0, Math.min(1, (viewX - padX) / (width - padX * 2)));
    setActiveIndex(Math.round(ratio * (visiblePoints.length - 1)));
  };
  return (
    <article className="line-chart-card">
      <header><div><p>{subtitle}</p><h4>{title}</h4></div><div className="chart-latest"><strong>{format(latest.value)}</strong><span className={delta >= 0 ? "up" : "down"} title={`${shortDate(latest.date)} 对比 ${shortDate(first.date)}`}><small>较 {shortDate(first.date)}</small><b>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</b></span>{events.length > 0 && <small className="chart-event-count">{events.length} 个事件</small>}</div></header>
      <div className="chart-canvas">
        <span className="chart-max">{format(max)}</span><span className="chart-min">{format(min)}</span>
        <div className="chart-plot">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            tabIndex={0}
            aria-label={`${title}从${shortDate(first.date)}到${shortDate(latest.date)}的变化；图上标记${eventMarkers.length}个近期事件；悬停或使用左右方向键查看每日数据`}
            preserveAspectRatio="none"
            onPointerMove={(event) => selectNearestPoint(event.clientX, event.currentTarget)}
            onPointerDown={(event) => selectNearestPoint(event.clientX, event.currentTarget)}
            onPointerLeave={(event) => { if (event.pointerType !== "touch") setActiveIndex(null); }}
            onFocus={() => setActiveIndex(visiblePoints.length - 1)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              if (event.key === "Home") return setActiveIndex(0);
              if (event.key === "End") return setActiveIndex(visiblePoints.length - 1);
              const current = resolvedActiveIndex ?? visiblePoints.length - 1;
              setActiveIndex(Math.max(0, Math.min(visiblePoints.length - 1, current + (event.key === "ArrowRight" ? 1 : -1))));
            }}
          >
            {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={height * ratio} y2={height * ratio} className="chart-grid-line" />)}
            {eventMarkers.map((marker, markerIndex) => <g key={`${marker.events[0].date}-${markerIndex}`} className="chart-event-guide"><line x1={coords[marker.index].x} x2={coords[marker.index].x} y1={padY} y2={height - padY} /><circle cx={coords[marker.index].x} cy={height - padY} r="4" /></g>)}
            <path d={`${path} L${coords[coords.length - 1].x} ${height - padY} L${coords[0].x} ${height - padY} Z`} fill={accent} className="chart-area" />
            <path d={path} fill="none" stroke={accent} className="chart-line" />
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="5" fill={accent} className="chart-dot" />
            {activeCoord && <><line x1={activeCoord.x} x2={activeCoord.x} y1={padY} y2={height - padY} className="chart-hover-line" /><circle cx={activeCoord.x} cy={activeCoord.y} r="7" fill={accent} className="chart-hover-dot" /></>}
          </svg>
          {eventMarkers.length > 0 && <div className="chart-event-layer" aria-label="趋势图近期事件标记">
            {eventMarkers.map((marker, markerIndex) => {
              const coord = coords[marker.index];
              const label = marker.events.length > 1 ? `${marker.events[0].title} +${marker.events.length - 1}` : marker.events[0].title;
              return <button className={`chart-event-marker ${activeEventIndex === markerIndex ? "active" : ""}`} style={{ left: `${(coord.x / width) * 100}%`, top: `${8 + (eventMarkerLanes[markerIndex] || 0) * 23}px` }} onClick={() => setActiveEventIndex(markerIndex)} aria-label={`${shortDate(marker.events[0].date)}：${label}`} title={`${shortDate(marker.events[0].date)} · ${label}`} key={`${marker.events[0].date}-${markerIndex}`}><i>{marker.events.length > 1 ? marker.events.length : "·"}</i><span>{label}</span></button>;
            })}
          </div>}
          {activePoint && activeCoord && <div className="chart-tooltip" data-edge={tooltipEdge} role="status" style={{ left: `${(activeCoord.x / width) * 100}%`, top: `${(activeCoord.y / height) * 100}%` }}><span>{shortDate(activePoint.date)}</span><small>{title}</small><strong>{format(activePoint.value)}</strong></div>}
        </div>
      </div>
      {activeEvent && <div className="chart-event-detail" role="status"><div><span>{shortDate(activeEvent.date)}</span><b>{activeEvent.kind}</b><small>{activeEvent.dateMeaning}{activeEvent.publishedDate && activeEvent.publishedDate !== activeEvent.date ? ` · 消息 ${shortDate(activeEvent.publishedDate)}` : ""}</small></div><strong>{activeEvent.title}</strong><p>{activeEvent.summary}</p><footer><span>{activeEvent.source}</span>{activeEvent.url && <a href={activeEvent.url} target="_blank" rel="noreferrer">查看信源 ↗</a>}</footer></div>}
      <footer><span>{shortDate(first.date)}</span><b>{visiblePoints.length} 个{granularity === "weekly" ? "周级" : "日级"}样本</b><span>{shortDate(latest.date)}</span></footer>
      {points.length > 2 && <div className="chart-range-control"><div><span>调整起始日期</span><b>{shortDate(first.date)}–{shortDate(latest.date)}</b></div><input type="range" min={0} max={maxStartIndex} step={1} value={safeStartIndex} aria-label={`${title}图表起始日期`} aria-valuetext={`${shortDate(first.date)}至${shortDate(latest.date)}`} onChange={(event) => { setRangeStartIndex(Number(event.currentTarget.value)); setActiveIndex(null); }} style={{ background: `linear-gradient(to right,#dbe3ef 0 ${rangeProgress}%,${accent} ${rangeProgress}% 100%)`, "--chart-accent": accent } as CSSProperties} /><small><span>{shortDate(points[0].date)}</span><span>最新</span></small></div>}
    </article>
  );
}


function TrendUnavailable({ title, reason }: { title: string; reason: string }) {
  return <article className="line-chart-card trend-unavailable"><span>数据缺口</span><h4>{title}</h4><p>{reason}</p><small>缺失序列不插值、不推算。</small></article>;
}

function ProductTrendPanel({ trend, game, externalEvents }: { trend: Record<string, any>; game?: Game; externalEvents?: unknown }) {
  const hasActivity = Boolean(trend.activity?.points?.length);
  const hasRevenue = Boolean(trend.revenue?.points?.length);
  const activitySubtitle = /ACU|CCU|同时在线/i.test(trend.activity?.label || "") ? "同时在线（日频）" : "用户活跃（日频）";
  const trendEvents = useMemo(() => buildTrendEvents(game, trend, externalEvents), [game, trend, externalEvents]);
  if (!hasActivity && !hasRevenue) return <p className="chart-note">暂未收录每日数据，暂无趋势图。</p>;
  return (
    <section className="platform-trend-section">
      <div className="section-heading heading-with-note"><div><p className="eyebrow">{trend.title ? "PLAYER TREND" : "90 DAY TREND"}</p><h3>{trend.title || "近 3 个月数据趋势"}</h3></div><span>{trend.activity?.scope || trend.revenue?.scope || "平台指标"} · {trend.source || "DataBrain"}</span></div>
      <div className="trend-grid">
        {hasActivity ? <LineChart title={trend.activity.label || "DAU"} subtitle={trend.activity.granularity === "daily" ? activitySubtitle : "用户活跃"} points={trend.activity.points} granularity={trend.activity.granularity} events={trendEvents} /> : <TrendUnavailable title={trend.activity?.label || "DAU"} reason={trend.activity?.unavailable_reason || "暂无可核验的近三个月日频活跃序列。"} />}
        {hasRevenue ? <LineChart title={trend.revenue.label || "收入"} subtitle="商业表现" points={trend.revenue.points} format={money} accent="#12a27b" granularity={trend.revenue.granularity} /> : <TrendUnavailable title={trend.revenue?.label || "收入"} reason={trend.revenue?.unavailable_reason || "暂无可核验的近三个月收入序列。"} />}
      </div>
      {trend.note && <p className="chart-note">{trend.note}</p>}
    </section>
  );
}

function Timeline({ items = [], empty = "暂无可核验节点。" }: { items?: Array<Record<string, any>>; empty?: string }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <div className="intel-timeline">
      {items.map((item, index) => (
        <article className={`timeline-item ${timelineStatus(item)}`} key={`${item.date}-${item.title}-${index}`}>
          <div className="timeline-date"><span>{shortDate(item.date)}</span><i /></div>
          <div className="timeline-copy"><div><b>{item.type || "版本更新"}</b>{item.source && <span>{item.source}</span>}</div><h4>{item.title || item.version || "重要节点"}</h4><p>{item.summary || item.description || "暂无摘要"}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">查看信源 ↗</a>}</div>
        </article>
      ))}
    </div>
  );
}

function VideoCover({ thumbnail, unavailable, platform }: { thumbnail: string; unavailable: boolean; platform: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(thumbnail) && !failed;
  return (
    <span className={`video-cover ${showImage ? "" : "video-cover-empty"}`}>
      {showImage ? <img src={publicAssetUrl(thumbnail)} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <small>{unavailable ? "视频已失效" : "封面暂缺"}</small>}
      <i>{unavailable ? "⌕" : "▶"}</i><b>{platform}</b>
    </span>
  );
}

function VideoGallery({ items = [], empty = "暂无可核验的 Demo / 实机视频。", thumbnailMap = VIDEO_THUMBNAILS, statusMap = {} }: { items?: Array<Record<string, string>>; empty?: string; thumbnailMap?: Record<string, string>; statusMap?: Record<string, string> }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <div className="video-gallery">
      {items.slice(0, 3).map((item, index) => {
        const thumbnail = videoThumbnail(item.url, thumbnailMap);
        const unavailable = statusMap[mediaCoverKey(item.url)] === "unavailable";
        const replacementNote = item.replacement_note || "";
        const targetUrl = unavailable ? videoSearchUrl(item) : item.url;
        return (
          <a className={`video-card ${unavailable ? "video-card-unavailable" : ""} ${replacementNote ? "video-card-replacement" : ""}`} href={targetUrl} target="_blank" rel="noreferrer" key={`${item.url}-${index}`}>
            <VideoCover thumbnail={unavailable ? "" : thumbnail} unavailable={unavailable} platform={item.platform || item.source || "视频"} />
            <span className="video-copy"><small>{shortDate(item.date)} · {item.type || "实机"}</small><strong>{item.title || "查看视频"}</strong><em>{unavailable ? "视频已失效 · 搜索替代内容 ↗" : replacementNote ? `${replacementNote} · 打开替代视频 ↗` : thumbnail ? "打开原网页 ↗" : "封面暂缺 · 打开原网页 ↗"}</em></span>
          </a>
        );
      })}
    </div>
  );
}

function lifecyclePhase(item: Record<string, unknown>) {
  const explicitPhase = recordText(item, "lifecycle_phase");
  if (["project", "recruitment", "internal", "first", "retest", "prelaunch", "experience", "license", "release", "launch"].includes(explicitPhase)) return explicitPhase;
  const type = recordText(item, "type");
  const kind = recordText(item, "kind");
  const title = recordText(item, "title");
  // Classify the milestone itself. A summary often mentions the next phase
  // (for example "正式上线前排除问题") and must not move the current node.
  const milestoneText = `${type} ${kind} ${title}`;
  if (/版号|ISBN/.test(milestoneText)) return "license";
  if (/^(首次公开|首曝)$/.test(kind)) return "project";
  if (/^(正式上线|正式公测|官方上线|公测开启|全球上线|全平台上线|PC\s*先行版正式上线)$/i.test(type) || /^(正式上线|正式公测|官方上线|公测开启|全球上线)$/i.test(kind)) return "launch";
  if (/终测|不删档|删档计费|计费测试|上线前|公测前|回炉版本|重新开服|开服验证|测试收官|软启动|Soft Launch/i.test(milestoneText)) return "prelaunch";
  if (/二测|三测|第二次测试|定格测试|星旅二测|进化测试|加测/.test(milestoneText)) return "retest";
  if (/首测|首次.{0,6}测试|首次公开测试|冒泡测试|大狩猎测试|藏锋测试|宜居测试|结缘测试|国服首测|海外开测|公开测试|测试(?:招募|开启|开始|结束|收官|复盘|定档|信息|体验)|Open Beta|Public Playtest|公开\s*Playtest/i.test(milestoneText)) return "first";
  if (/内测|内部测试|小范围技术|保密测试|技术封测/.test(milestoneText)) return "internal";
  if (/定档|预约|上线准备|上线筹备|发行准备|资源预载|官宣.{0,16}(?:上线|发售)|计划.{0,16}(?:上线|发售)|预计.{0,16}(?:上线|发售)|将于.{0,16}(?:上线|发售)/.test(milestoneText)) return "release";
  if (/首曝|首次公开|首亮相|首支\s*PV|发布会|正式定名|产品公布|官宣新作/.test(milestoneText)) return "project";
  if (/正式上线|正式公测|全平台上线|公测开启|全球上线|确认\s*2026\s*年内发售/.test(title)) return "launch";
  return "";
}

function lifecycleLabel(item: Record<string, unknown>) {
  const phase = lifecyclePhase(item);
  if (phase === "retest") {
    const milestoneText = `${recordText(item, "type")} ${recordText(item, "kind")} ${recordText(item, "title")}`;
    if (/三测|第三次测试/.test(milestoneText)) return "三测";
    if (/二测|第二次测试|第二次玩法技术测试/.test(milestoneText)) return "二测";
    return "复测";
  }
  const labels: Record<string, string> = {
    project: "首次公开",
    recruitment: "测试招募",
    internal: "内测",
    first: "首次测试",
    prelaunch: "上线前测试",
    experience: "体验服",
    license: "版号节点",
    release: "上线准备",
    launch: "正式上线",
  };
  return labels[phase] || recordText(item, "type") || "阶段证据";
}

const TEST_LIFECYCLE_PHASES = new Set(["internal", "first", "retest", "prelaunch"]);
const MERGEABLE_LIFECYCLE_PHASES = new Set([...TEST_LIFECYCLE_PHASES, "release"]);

function timelineDay(value: unknown) {
  const normalized = dateKey(value);
  return normalized ? Math.floor(new Date(`${normalized}T00:00:00Z`).getTime() / 86400000) : Number.NaN;
}

function testMilestoneName(item: Record<string, unknown>) {
  const title = readableHeadline(recordText(item, "title"));
  const quoted = title.match(/[“\"]([^”\"]{1,18}(?:测试|首测|二测|三测|终测))[”\"]/i)?.[1];
  const named = title.match(/旧版限量测试|新玩法测试|保密测试|秋季测试|冬季测试|终极测试|安家测试|定格测试|藏锋测试|冒泡测试|大狩猎测试|宜居测试|星旅二测|结缘测试|进化测试|终测|计费测试|不删档测试|国服首测|公开测试|Public Playtest|Open Beta/i)?.[0];
  const plain = title.match(/([\u4e00-\u9fffA-Za-z0-9·]{2,8}(?:测试|首测|二测|三测|终测))/i)?.[1];
  return (quoted || named || plain || "")
    .replace(/^(首次|首轮|第二次|第三次)/, "")
    .replace(/^(公开|限号|限量|删档|不删档)/, "")
    .trim();
}

function compactMilestoneSummary(item: Record<string, unknown>) {
  const copy = readableHeadline(recordText(item, "summary") || recordText(item, "description") || "暂无摘要");
  const firstSentence = copy.match(/^.*?[。！？!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || copy;
}

function isSupportingMilestone(item: Record<string, unknown>) {
  return /媒体|复盘|评测|测评|试玩|报告|观察|体验/.test(`${recordText(item, "kind")} ${recordText(item, "type")}`);
}

function timelineRange(items: Array<Record<string, unknown>>) {
  const ranged = items.find(item => dateKey(item.date) && dateKey(item.end_date) && !isSupportingMilestone(item));
  if (ranged) return `${shortDate(recordText(ranged, "date"))}–${shortDate(recordText(ranged, "end_date"))}`;
  const starts = items.filter((item) => !isSupportingMilestone(item) && !/招募|资格|预约/.test(recordText(item, "title")) && /开启|开测|开始|首日|计划开启|计划开测|定档|重新开服|开服验证/.test(`${recordText(item, "type")} ${recordText(item, "title")}`));
  const ends = items.filter((item) => !isSupportingMilestone(item) && /结束|收官|关服|截止/.test(`${recordText(item, "type")} ${recordText(item, "title")}`));
  const fallback = ends.length ? ends : items;
  const start = (starts.length ? starts : fallback).map((item) => dateKey(item.date)).filter(Boolean).sort()[0] || "";
  const end = ends.map((item) => dateKey(item.date)).filter(Boolean).sort().at(-1) || "";
  if (!start) return "待确认";
  if (!starts.length || !end || end <= start) return shortDate(start);
  const [startYear] = start.split("-");
  const [endYear, endMonth, endDay] = end.split("-");
  return startYear === endYear ? `${shortDate(start)}–${endMonth}.${endDay}` : `${shortDate(start)}–${shortDate(end)}`;
}

function timelineEvidenceItem(item: Record<string, unknown>): Record<string, string> | null {
  const text = `${recordText(item, "type")} ${recordText(item, "kind")} ${recordText(item, "title")} ${recordText(item, "source")}`;
  const url = recordText(item, "url");
  if (!url || (evidenceKind(item) !== "video" && !/测评|评测|实机|体验|复盘|回顾|试玩|媒体|观察|GameLook|17173|游戏茶馆|游民星空/i.test(text))) return null;
  return {
    date: recordText(item, "date"),
    url,
    title: readableHeadline(recordText(item, "title") || "阶段报告"),
    type: recordText(item, "kind") || recordText(item, "type") || "阶段报告",
    source: recordText(item, "source") || "公开信源",
    evidence_kind: evidenceKind(item),
  };
}

function condensedProgressNodes(milestones: Array<Record<string, unknown>>) {
  const nodes: Array<{
    phase: string;
    family: string;
    items: Array<Record<string, unknown>>;
    dateKeys: string[];
    sortDate: string;
    displayDate: string;
    label: string;
    title: string;
    summary: string;
    source: string;
    url: string;
    planned: boolean;
    evidence: Array<Record<string, string>>;
  }> = [];

  milestones.forEach((item) => {
    const phase = lifecyclePhase(item);
    const family = testMilestoneName(item);
    const itemDay = timelineDay(item.date);
    let node = MERGEABLE_LIFECYCLE_PHASES.has(phase) ? [...nodes].reverse().find((candidate) => {
      if (candidate.phase !== phase) return false;
      const lastDay = Math.max(...candidate.items.map((entry) => timelineDay(entry.date)).filter(Number.isFinite));
      const closeEnough = Number.isFinite(itemDay) && Number.isFinite(lastDay) && itemDay - lastDay <= 50;
      return Boolean(family && candidate.family && family === candidate.family) || closeEnough;
    }) : undefined;

    if (!node) {
      node = { phase, family, items: [], dateKeys: [], sortDate: "", displayDate: "", label: "", title: "", summary: "", source: "", url: "", planned: false, evidence: [] };
      nodes.push(node);
    }
    node.items.push(item);
    if (!node.family && family) node.family = family;
  });

  const compacted = nodes.map((node) => {
    node.items.sort((a, b) => (dateKey(a.date) || "9999-99-99").localeCompare(dateKey(b.date) || "9999-99-99"));
    const ending = [...node.items].reverse().find((item) => !isSupportingMilestone(item) && /结束|收官|关服/.test(`${recordText(item, "type")} ${recordText(item, "title")}`));
    const opening = node.items.find((item) => !isSupportingMilestone(item) && !/招募|资格|预约/.test(recordText(item, "title")) && /开启|开测|开始|首日|计划开启|计划开测|定档|重新开服|开服验证|上线准备|上线筹备|官宣/.test(`${recordText(item, "type")} ${recordText(item, "title")}`));
    const primary = ending?.source === "看板研判" ? opening || node.items.find(item => item.source !== "看板研判" && !isSupportingMilestone(item)) || ending : ending || opening || node.items[0];
    node.dateKeys = node.items.map((item) => dateKey(item.date)).filter(Boolean);
    node.sortDate = node.items
      .filter((item) => !isSupportingMilestone(item))
      .map((item) => dateKey(item.date))
      .filter(Boolean)
      .sort()[0] || node.dateKeys[0] || "9999-99-99";
    const explicitDisplayDate = node.items.map((item) => recordText(item, "display_date")).find(Boolean);
    node.displayDate = explicitDisplayDate || (MERGEABLE_LIFECYCLE_PHASES.has(node.phase) ? timelineRange(node.items) : shortDate(recordText(primary, "date")));
    node.label = lifecycleLabel(primary);
    node.title = TEST_LIFECYCLE_PHASES.has(node.phase) && node.family ? node.family : readableHeadline(recordText(primary, "title") || recordText(primary, "version") || "重要节点");
    node.summary = compactMilestoneSummary(primary);
    node.source = recordText(primary, "source");
    node.url = recordText(primary, "url");
    node.planned = node.items.every((item) => timelineStatus(item) === "planned");
    node.evidence = node.items
      .map(timelineEvidenceItem)
      .filter((item): item is Record<string, string> => Boolean(item) && (item?.url !== node.url || item.evidence_kind === "video"));
    return node;
  });
  return compacted.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
}

function buildProgressMediaNodes(milestones: Array<Record<string, unknown>>, media: Array<Record<string, string>>) {
  const nodes = condensedProgressNodes(milestones);
  const unlinkedMedia: Array<Record<string, string>> = [];
  media.forEach((item) => {
    const reveal = /首曝|首次公开|首支.*(?:PV|预告)|announcement trailer|reveal trailer/i.test(`${item.type || ""} ${item.title || ""}`);
    const linkedDate = dateKey(item.milestone_date || item.date);
    let target = nodes.find((node) => linkedDate && node.dateKeys.includes(linkedDate));
    if (reveal && !item.milestone_date && target?.phase !== "project") target = undefined;
    if (!target && linkedDate && !item.milestone_date && item.node_link_status !== "unconfirmed") {
      const linkedDay = timelineDay(linkedDate);
      target = [...nodes]
        .map((node) => ({ node, distance: Math.min(...node.dateKeys.map((value) => Math.abs(timelineDay(value) - linkedDay))) }))
        .filter((entry) => Number.isFinite(entry.distance) && entry.distance <= 45 && (!reveal || entry.node.phase === "project"))
        .sort((a, b) => a.distance - b.distance)[0]?.node;
    }
    if (item.node_link_status === "unconfirmed") target = undefined;
    if (target && !target.evidence.some((entry) => entry.url === item.url)) target.evidence.push({ ...item, evidence_kind: evidenceKind(item) });
    if (!target) unlinkedMedia.push(item);
  });
  nodes.forEach((node) => {
    const seen = new Set<string>();
    node.evidence = node.evidence
      .sort((a, b) => (a.evidence_kind === b.evidence_kind ? 0 : a.evidence_kind === "video" ? -1 : 1))
      .filter((item) => Boolean(item.url) && !seen.has(item.url) && Boolean(seen.add(item.url)));
  });
  return { nodes, unlinkedMedia };
}

function ProjectProgressMedia({ milestones = [], media = [], status, thumbnailMap = VIDEO_THUMBNAILS, statusMap = {} }: {
  milestones?: Array<Record<string, unknown>>;
  media?: Array<Record<string, string>>;
  status?: string;
  thumbnailMap?: Record<string, string>;
  statusMap?: Record<string, string>;
}) {
  const { nodes, unlinkedMedia } = buildProgressMediaNodes(milestones, media);

  return (
    <section className="pipeline-detail-section progress-media-section" aria-label="项目进展与实机">
      <div className="section-heading heading-with-note"><div><p className="eyebrow">PROGRESS & GAMEPLAY</p><h3>项目进展与实机</h3></div><span>{status || "按时间串联重要阶段与同期公开影像"}</span></div>
      {nodes.length ? <div className="progress-media-timeline">
        {nodes.map((node, nodeIndex) => {
          return <article className={`progress-media-node ${node.planned ? "planned" : "confirmed"}`} key={`${node.displayDate}-${nodeIndex}`}>
            <div className="progress-media-date"><span>{node.displayDate}</span><i /></div>
            <div className={`progress-media-card has-milestone ${node.evidence.length ? "has-media" : ""}`}>
              <div className="progress-milestone-copy">
                <div><b>{node.label}</b>{node.source && <span>{node.source}</span>}</div>
                <h4>{node.title}</h4>
                <p>{node.summary}</p>
                {node.url && !node.evidence.some((entry) => entry.url === node.url) && <a href={node.url} target="_blank" rel="noreferrer">查看信源 ↗</a>}
              </div>
              {node.evidence.length > 0 && <div className="progress-media-list">{node.evidence.map((item, mediaIndex) => {
                  const thumbnail = videoThumbnail(item.url, thumbnailMap);
                  const unavailable = statusMap[mediaCoverKey(item.url)] === "unavailable";
                  const targetUrl = unavailable ? videoSearchUrl(item) : item.url;
                  const isVideo = item.evidence_kind === "video";
                  return <a className={`${unavailable ? "unavailable" : ""} ${isVideo ? "video" : "report"}`} href={targetUrl || "#"} target="_blank" rel="noreferrer" key={`${item.url}-${mediaIndex}`}>
                    {isVideo ? <VideoCover thumbnail={unavailable ? "" : thumbnail} unavailable={unavailable} platform={item.platform || item.source || "视频"} /> : <span className="progress-report-cover"><b>报告</b><small>{item.source || item.platform || "公开信源"}</small></span>}
                    <span><small>{item.date && `${shortDate(item.date)} · `}{item.type || (isVideo ? "Demo / 实机" : "阶段报告")}</small><strong>{item.title || (isVideo ? "查看阶段影像" : "查看阶段报告")}</strong><em>{unavailable ? "视频已失效 · 搜索替代内容 ↗" : isVideo ? "打开视频 ↗" : "阅读报告 ↗"}</em></span>
                  </a>;
              })}</div>}
            </div>
          </article>;
        })}
      </div> : <p className="empty">{unlinkedMedia.length ? "节点日期待确认，公开影像见下方。" : "暂无可核验的项目进展节点。"}</p>}
      {unlinkedMedia.length > 0 && <div className="progress-public-media"><h4>公开影像 · 以发布时间标注</h4><VideoGallery items={unlinkedMedia} thumbnailMap={thumbnailMap} statusMap={statusMap} /></div>}
    </section>
  );
}

const DASHBOARD_TIME_ZONE = "Asia/Shanghai";

function currentDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateKey(value?: unknown) {
  const raw = String(value || "").trim();
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  const match = raw.match(/(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${(match[3] || "01").padStart(2, "0")}`;
}

function latestVerifiedDataDate(data: DashboardData, asOf: string) {
  const candidates = [
    dateKey(data.trendMeta?.updated),
    ...(Array.isArray(data.trendMeta?.query_range) ? data.trendMeta.query_range.map(dateKey) : []),
    ...Object.values(data.pcMetrics || {}).map((item) => dateKey(item.data_date)),
    ...data.games.flatMap((game) => [dateKey(game.metrics?.data_date), dateKey(game.metrics?.dau_data_date), dateKey(game.metrics?.acu_data_date)]),
  ].filter((date) => date && date <= asOf);
  return candidates.sort().at(-1) || asOf;
}

function timelineStatus(item: Record<string, any>, asOf = currentDateKey()) {
  if (item.status) return item.status;
  const date = dateKey(item.date);
  return date && date > asOf ? "planned" : "confirmed";
}

function sortTimeline(items: Array<Record<string, any>>) {
  const normalized: Array<Record<string, any>> = items
    .map((item) => ({ ...item, status: timelineStatus(item) }))
  return normalized.sort((a, b) => (dateKey(a.date) || "9999-99-99").localeCompare(dateKey(b.date) || "9999-99-99"));
}

function timelineType(text: string) {
  if (/版号|ISBN/.test(text)) return "版号节点";
  if (/测试|首测|二测|三测|终测|冒泡|安家|删档|计费|试玩|收官|回炉版本|重新开服|开服验证/.test(text)) return "重大测试";
  if (/定档|预约|发行计划|上线准备|上线筹备|官宣.{0,16}(?:上线|发售)|计划.{0,16}(?:上线|发售)|预计.{0,16}(?:上线|发售)/.test(text)) return "上线准备";
  if (/公测|上线|正式版|发售|软启动|Early Access|\bEA\b|Open Beta/.test(text)) return "公测 / 上线";
  if (/首曝|首次公开|首亮相|发布会|定名|PV|预告/.test(text)) return "首次公开";
  return "阶段证据";
}

function liveOpsType(item: Record<string, any>) {
  const text = `${item.version || ""} ${item.title || ""} ${item.summary || ""} ${item.type || ""}`;
  if (/版本|赛季|season|patch|\bv\d|更新/.test(text)) return "版本更新";
  if (/玩法|模式|地图|角色|英雄|关卡|系统|副本|机制|UGC|工坊|创作|功能/.test(text)) return "玩法变化";
  if (/联动|活动|节日|奖励|皮肤/.test(text)) return "内容运营";
  return "公开动态";
}

function pipelineMilestones(name: string, item: Record<string, any>, fallbackItem?: Record<string, any>) {
  const testingSource = item.testing?.records?.length ? item : fallbackItem?.testing?.records?.length ? fallbackItem : null;
  const testingRecords = (testingSource?.testing?.records || []).map((entry: Record<string, any>) => {
    const text = `${entry.title || ""} ${entry.summary || ""} ${entry.type || ""}`;
    return {
      ...entry,
      type: entry.type || timelineType(text),
      title: entry.title || "测试节点",
      summary: entry.summary || `公开信源记录：${entry.title || "该项目出现新的测试信息"}。`,
    };
  });
  const reports = (item.media_reports || []).filter((entry: Record<string, any>) => entry.timeline === true).map((entry: Record<string, any>) => {
    const text = `${entry.title || ""} ${entry.summary || ""} ${entry.kind || ""}`;
    return {
      ...entry,
      type: timelineType(text),
      title: entry.timeline_title || entry.title || "公开研发节点",
      source: entry.timeline_date_basis === "report_date" ? `${entry.source || "GRP"} · 报告日期` : entry.source,
      summary: entry.summary || `公开信源记录：${entry.title || "该项目出现新的研发信息"}。`,
    };
  });
  const stage = item.stage_date && dateKey(item.stage_date) ? [{ date: item.stage_date, type: "当前阶段", title: item.stage || item.release_status || "项目阶段更新", summary: item.assessment?.verdict?.summary || item.analysis?.readiness || "项目进入新的研发阶段。", source: "看板研判" }] : [];
  // The detail header already carries the current stage. If a same-day report
  // exists, don't render that status a second time as a duplicate milestone.
  const stageDate = dateKey(stage[0]?.date);
  const entries = [
    ...testingRecords,
    ...reports,
    ...(stageDate && [...testingRecords, ...reports].some((entry: Record<string, unknown>) => dateKey(entry.date) === stageDate) ? [] : stage),
  ];
  // Reports can be merged from several feeds (for example an official post,
  // a snapshot and the generated enrichment bundle). Collapse exact repeats
  // before rendering so one milestone never occupies several stacked cards.
  const seen = new Set<string>();
  const dated = entries.filter((entry: Record<string, unknown>) => {
    if (!dateKey(entry.date)) return false;
    const url = recordText(entry, "url");
    const key = [dateKey(entry.date), url || recordText(entry, "type") || recordText(entry, "kind"), url ? "" : recordText(entry, "title") || recordText(entry, "version")].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const important = dated.filter((entry: Record<string, unknown>) => entry.type !== "阶段证据");
  return sortTimeline(important.length ? important : dated);
}

type PipelineTeamProfile = {
  studio: string;
  size: string;
  previous: string[];
  note: string;
  company?: string;
  organization?: string;
  location?: string;
  keyMembers?: Array<{ role: string; name: string }>;
  experience?: string;
  developmentCycle?: string;
  cost?: string;
  sources?: Array<{ label: string; scope: string; url: string }>;
  sourceUrl?: string;
  sourceLabel?: string;
};

const PIPELINE_TEAM_PROFILES: Record<string, PipelineTeamProfile> = {
  "粒粒的小人国": { studio: "SGRA 银之心工作室（腾讯北极光工作室群旗下）", company: "腾讯", organization: "腾讯北极光工作室群 · SGRA 银之心工作室", size: "未公开", previous: ["龙息神寂"], note: "SGRA 官方网站同时列出《龙息神寂》和《粒粒的小人国》；团队人数暂未公开。", sourceUrl: "https://sgrastudio.com/", sourceLabel: "SGRA 官方网站" },
  "王者万象棋": {
    studio: "《王者万象棋》项目组", company: "腾讯游戏", organization: "王者荣耀项目团队（具体工作室未披露）", size: "未公开", previous: ["王者荣耀"],
    experience: "官方产品页明确称由《王者荣耀》原班人马研发；具体工作室、核心成员和团队规模未披露。",
    developmentCycle: "2026 年完成终测 · 已定档 2026 年 9 月上线",
    note: "仅采用官方确认的团队继承关系，不再以腾讯其他策略产品作项目组履历外推。",
    sources: [{ label: "TapTap 官方", scope: "研发团队口径 · 平台 · 上线窗口", url: "https://www.taptap.cn/app/243110" }],
  },
  Aniimo: {
    studio: "Pawprint Studio（杭州爪印工作室）",
    company: "FunPlus（趣加）",
    organization: "FunPlus 投资孵化 · 国内上海趣乐糖发行 · 海外 Pawprint / Kingsglory Games",
    location: "杭州",
    size: "未公开",
    previous: [],
    experience: "团队官方称成员由热爱游戏的资深玩家组成；具体成员姓名与同团队前作未公开。",
    developmentCycle: "官方确认研发已超过一年 · 2025 年 6 月首曝 · 2026 年 9 月首发",
    cost: "未公开",
    note: "开发团队、投资发行关系与所在地已核验；人数、核心成员姓名和成本尚未公开。",
    sources: [
      { label: "DataBrain 内部游戏库", scope: "研发主体 · 投资发行关系 · 平台与发行信息", url: "https://databrain.woa.com/v2/agent/chat?sessionId=skill_61d3b5514df44bd4" },
      { label: "《伊莫》官方", scope: "产品归属 · 平台 · 发行状态", url: "https://www.aniimo.com/main" },
      { label: "开发团队公开信", scope: "研发周期 · 团队背景", url: "https://aniimoguide.com/patch-notes/a-letter-from-the-aniimo-dev-team" },
    ],
  },
  "妖妖棋": {
    studio: "网易雷火《妖妖棋》项目组",
    company: "网易游戏",
    organization: "雷火工作室 · 研发与运营主体：杭州网易雷火科技有限公司",
    location: "项目组办公地未披露（研发主体注册地为杭州）",
    size: "未披露（GRP #74 与 DataBrain Management 已核查）",
    previous: ["同项目组前作未披露"],
    keyMembers: [{ role: "制作人 / 核心成员", name: "未披露（已核查）" }],
    experience: "现有信源只能确认网易雷火归属；不把《逆水寒》《倩女幽魂》等厂商产品外推为该项目组前作。",
    developmentCycle: "至少于 2025.12.19–2026.01.04 完成第二次玩法技术测试 · 2026 年 1 月获版号 · 当前预约中",
    cost: "未披露（GRP #74 与 DataBrain Management 已核查）",
    note: "研发主体、网易雷火归属、二测与版号节点已核验；项目组办公地、人数、成员履历和研发预算在当前内部与公开信源中均未披露。",
    sources: [
      { label: "DataBrain Management", scope: "研发主体 · 组织归属 · 人力与成本披露核查", url: "https://databrain.woa.com/v2/agent/chat?sessionId=skill_8bbfde2c1c774456" },
      { label: "GRP 报告 #74", scope: "二测产品分析 · 当前报告未披露项目人数与预算", url: "https://grp.woa.com/report.html?id=74" },
      { label: "TapTap 官方", scope: "研发主体 · 二测节点 · 更名与版号状态", url: "https://www.taptap.cn/app/756756/topic?type=official" },
    ],
  },
  "山海奇旅": {
    studio: "《山海奇旅》项目组",
    company: "网易互娱",
    organization: "水滴事业部",
    location: "杭州（事业部口径；项目组办公地待确认）",
    size: "约 40 人（策划 10 人）",
    previous: ["一梦江湖"],
    keyMembers: [{ role: "Lead Game Designer · 2024 首曝", name: "Zane Li Hai" }],
    experience: "《一梦江湖》为水滴事业部代表产品，尚未确认与本项目属于同一项目组。",
    developmentCycle: "约 2020 年立项 · 2024 年底冻结 · 2026 年 4 月解冻",
    note: "公开口径确认项目归属水滴事业部；下属具体工作室或项目组名称尚未披露。",
    sources: [
      { label: "GRP 报告 #163", scope: "团队规模 · 研发周期", url: "https://grp.woa.com/report.html?id=163" },
      { label: "IT之家", scope: "网易互娱水滴事业部归属 · 2026 产品口径", url: "https://www.ithome.com/0/981/528.htm" },
      { label: "PlayStation Blog", scope: "Zane · Lead Game Designer · 2024 首曝", url: "https://blog.playstation.com/2024/08/21/floatopia-is-coming-to-ps5-in-2025/" },
      { label: "GamesRadar+", scope: "Zane Li Hai 完整署名 · Gamescom 采访", url: "https://www.gamesradar.com/games/simulation/i-could-spend-years-in-floatopias-character-creator-an-upcoming-animal-crossing-style-life-sim-featuring-dolls-in-a-floating-toy-town/" },
      { label: "历史招聘线索", scope: "杭州水滴事业部 · 《一梦江湖》事业部口径", url: "https://www.nowcoder.com/discuss/353159200253616128" },
    ],
  },
  "诡影藏锋": {
    studio: "天谕工作室《诡影藏锋》项目组", company: "网易游戏", organization: "雷火事业群 · 天谕工作室", size: "约 100 人（此前约 80 人）", previous: [],
    keyMembers: [{ role: "项目负责人（GRP 口径）", name: "沈芳仙" }],
    developmentCycle: "2024 年 7 月立项 · 预计 2026 Q4–2027 Q1 上线", cost: "未公开",
    note: "GRP #169 已披露项目归属、负责人、扩编规模和预期窗口；过往项目经历与研发成本未披露。",
    sources: [{ label: "GRP 报告 #169", scope: "工作室 · 负责人 · 团队规模 · 研发周期", url: "https://grp.woa.com/report.html?id=169" }],
  },
  "星绘友晴天": {
    studio: "雷火事业群 UX（宇宙 X）工作室",
    company: "网易游戏",
    organization: "雷火事业群",
    size: "100 人以上",
    previous: ["公开未披露"],
    experience: "官方已确认团队长期聚焦生活模拟、社交派对与 UGC 组合，具体前作履历尚未公开。",
    developmentCycle: "2023 年立项 · 2025 年两轮测试 · 2026 年 4 月 PC 先行版上线",
    note: "Steam 开发者口径为 ThunderFire Universe X Studio；GRP #76 记录国内首测与百人以上团队规模。",
    sources: [
      { label: "Steam", scope: "研发团队 · 平台 · 发行计划", url: "https://store.steampowered.com/app/3384570/_/?l=schinese" },
      { label: "雷火官网", scope: "在研新游归属 · 官方产品介绍", url: "https://leihuo.163.com/#/" },
      { label: "TapTap 官方", scope: "PC 先行版 · 测试与运营状态", url: "https://www.taptap.cn/app/756412/topic?type=official" },
      { label: "GRP 报告 #76", scope: "立项时间 · 国内首测 · 团队规模", url: "https://grp.woa.com/report.html?id=76" },
    ],
  },
  "雾海之下": {
    studio: "织屋工作室",
    company: "网易游戏",
    organization: "雷火事业群",
    location: "成都",
    size: "未公开",
    previous: ["公开未披露"],
    keyMembers: [{ role: "制作人", name: "艾露" }],
    experience: "官方口径确认制作人艾露有成熟 MOBA 项目经验；具体过往职位与完整项目履历未公开，不作进一步推断。",
    developmentCycle: "2026 年 8 月首曝并完成首次公开测试",
    note: "官方说明网易在成都与制作人艾露组建织屋工作室，从头研发《雾海之下》；团队规模与成本尚未披露。",
    sources: [
      { label: "TapTap 官方", scope: "织屋工作室 · 成都 · 制作人 · 首测安排", url: "https://www.taptap.cn/app/894881" },
      { label: "雷火官网", scope: "雷火在研新游归属 · 官方玩法介绍", url: "https://leihuo.163.com/#/" },
      { label: "IT之家", scope: "首测日期 · 平台 · 测试性质", url: "https://www.ithome.com/0/985/879.htm" },
    ],
  },
  "星布谷地": {
    studio: "《星布谷地》项目组（代号 HYG）", company: "米哈游", organization: "具体事业部 / 工作室未披露", size: "约 160 人（2025 年口径）", previous: [],
    developmentCycle: "2021 年探索 · 2022 年预研 · 预计 2026 Q4 上线", cost: "未公开",
    note: "GRP #131 记录项目代号、研发节点、团队规模和预期窗口；不把米哈游厂商产品当作项目组前作。",
    sources: [{ label: "GRP 报告 #131", scope: "项目代号 · 团队规模 · 研发周期", url: "https://grp.woa.com/report.html?id=131" }],
  },
  "崩坏：因缘精灵": {
    studio: "《崩坏：因缘精灵》项目组", company: "米哈游", organization: "具体事业部 / 工作室未披露", size: "500 人以上（2026 年口径；2025 年底约 300 人）", previous: [],
    keyMembers: [{ role: "项目负责人 / 制作人（GRP 口径）", name: "大卫" }],
    developmentCycle: "2024 年初预研 · 2024 年 9 月正式立项 · 预计 2026 Q4 上线", cost: "未公开",
    note: "GRP #158 已披露负责人、团队快速扩编和研发节点；具体工作室与成本仍未公开。",
    sources: [{ label: "GRP 报告 #158", scope: "负责人 · 团队规模 · 研发周期", url: "https://grp.woa.com/report.html?id=158" }],
  },
  "生活派对": { studio: "《生活派对》制作团队（具体工作室未公开）", company: "莉莉丝游戏", size: "未公开", previous: [], keyMembers: [{ role: "制作团队代表", name: "刚子" }], note: "TapTap 官方开发者信息可确认制作团队代表；具体工作室、人数及团队前作未公开。", sources: [{ label: "TapTap 官方", scope: "制作团队代表 · 厂商归属", url: "https://www.taptap.cn/app/387202" }] },
  "Totally Mall": { studio: "Farlight Games（莉莉丝海外团队）", size: "未公开", previous: ["公开未披露"], note: "已确认由莉莉丝海外业务体系负责，具体研发小组和过往产品未公开拆分。" },
  "塔塔冒险队": { studio: "《塔塔冒险队》项目组", company: "莉莉丝游戏", organization: "具体工作室未披露", size: "约 40 人（2026 年媒体采访口径）", previous: [], keyMembers: [{ role: "制作人", name: "卡布" }, { role: "主美", name: "Leon" }], developmentCycle: "2026 年 7–8 月删档计费测试 · 9 月 4 日公测", note: "官方资料确认厂商归属和发行节点；团队规模与核心成员来自 2026 年媒体联合采访，具体工作室仍未披露。", sources: [{ label: "TapTap 官方", scope: "研发厂商 · 计费测试 · 公测时间", url: "https://www.taptap.cn/app/866257/topic?type=official" }, { label: "游戏媒体联合采访", scope: "团队规模 · 制作人 · 主美", url: "https://www.vgover.com/zh-tw/news/229761" }] },
  "小冰冰斗蛐蛐": { studio: "《小冰冰传奇》团队（莉莉丝）", size: "未公开", previous: ["小冰冰传奇"], note: "公开报道直接称其为《小冰冰传奇》团队新作，但未披露团队人数。", sourceUrl: "https://news.17173.com/content/07162026/115649851.shtml", sourceLabel: "首测报道" },
  "Fields of Mistria": { studio: "NPC Studio", company: "NPC Studio", size: "小型独立团队（精确人数未公开）", previous: [], developmentCycle: "2024 年 8 月 EA · 2026 年 8 月 1.0", note: "《Fields of Mistria》是目前公开的核心商业作品，团队过往项目未充分披露。", sources: [{ label: "Steam 官方", scope: "研发商 · 1.0 发行节点", url: "https://store.steampowered.com/news/app/2142790/view/671750120632486177" }] },
  Paralives: { studio: "Paralives Studio", company: "Paralives Studio", size: "独立团队（精确人数未公开）", previous: [], developmentCycle: "约 7 年社区驱动开发 · 2026 年 5 月 EA", note: "公开资料未给出稳定的团队人数、成本与前作清单。", sources: [{ label: "Paralives Studio", scope: "研发团队 · EA 内容与发行节点", url: "https://www.paralives.com/news/early-access-features" }] },
  Witchbrook: { studio: "Chucklefish × Robotality", company: "Chucklefish", organization: "Robotality 参与联合开发", size: "未公开", previous: [], developmentCycle: "计划 2026 年发行 · 确切日期未公布", note: "官方明确 Robotality 参与开发；不把 Chucklefish 厂牌其他产品直接计作本项目组前作。", sources: [{ label: "Witchbrook 官方", scope: "研发团队 · 开发状态 · 发行窗口", url: "https://www.witchbrook.com/category/dev-blog/" }] },
  "Starsand Island": { studio: "Seed Sparkle Lab", company: "Seed Sparkle Lab", size: "未公开", previous: [], developmentCycle: "Early Access · 2026 年 8 月 1.0", note: "当前公开资料主要围绕《星砂岛》本身，团队规模、成本与前作信息仍不完整。", sources: [{ label: "Steam 官方", scope: "研发主体 · 1.0 与多人版本", url: "https://steamcommunity.com/app/2966320/allnews/" }] },
  "Spirit Crossing": { studio: "Spry Fox", company: "Spry Fox", organization: "Netflix Games 发行", size: "约 50 人（媒体口径）", previous: ["Cozy Grove", "Alphabear", "Triple Town"], developmentCycle: "多年研发 · 2026 年 Steam 公开 Playtest", note: "团队规模来自媒体报道；公开测试状态与进度继承规则由 Spry Fox 官方支持页确认。", sources: [{ label: "Spry Fox", scope: "公开测试 · 进度继承", url: "https://support.spryfox.com/hc/en-us/articles/41145145342999-How-do-I-join-the-Steam-public-playtest" }, { label: "团队报道", scope: "团队规模 · 独立运营背景", url: "https://massivelyop.com/2026/01/15/spry-fox-bosses-slashed-their-salaries-to-buy-out-the-studio" }] },
  "My Time at Evershine": {
    studio: "Pathea Games《My Time at Evershine》项目组",
    company: "Pathea Games（帕斯亚）",
    organization: "My Time 系列研发团队（具体项目组组织未单独披露）",
    location: "重庆",
    size: "未公开",
    previous: ["波西亚时光", "沙石镇时光"],
    keyMembers: [{ role: "My Time 系列创意总监", name: "吴子飞（Zifei Wu）" }],
    experience: "Pathea Games 持续开发 My Time 系列，已完成《波西亚时光》和《沙石镇时光》的研发与长期运营。",
    developmentCycle: "2024 年 9 月 17 日首次公布 · 9 月 24 日启动 Kickstarter · Steam 当前标注 2027 年发售",
    cost: "研发预算未公开 · Kickstarter 筹得 $2,901,842（33,933 名支持者；不等同研发成本）",
    note: "开发主体、所在地、系列履历、创意总监与众筹规模已有公开信源；项目团队人数及研发预算尚未披露。",
    sources: [
      { label: "Steam 官方", scope: "开发商 · 发行年份 · PC 平台", url: "https://store.steampowered.com/app/3199500/My_Time_at_Evershine/" },
      { label: "Kickstarter", scope: "众筹金额 · 支持者人数", url: "https://www.kickstarter.com/projects/patheagames/my-time-at-evershine-the-next-my-time-tale" },
      { label: "Pathea 官方", scope: "重庆所在地 · 公司与系列背景", url: "https://www.pathea.net/about_cn.html" },
      { label: "RPGFan", scope: "创意总监 · 首曝与众筹时间", url: "https://www.rpgfan.com/2024/09/19/my-time-at-evershine-unveiled-kickstarter-launches-september-24th/" },
    ],
  },
  "裂隙远征": { studio: "Leyline", company: "Leyline", size: "未公开", previous: [], developmentCycle: "2026 年 1 月 Alpha · 7 月 Steam Demo", note: "Steam 商店已确认研发与发行主体；团队规模、核心成员和成本未披露。", sources: [{ label: "Steam", scope: "研发主体 · Demo · 玩家评价", url: "https://store.steampowered.com/app/4425970?l=schinese" }] },
  BigWalk: { studio: "House House", company: "House House", organization: "Panic 发行", size: "小型独立团队（精确人数未公开）", previous: ["Untitled Goose Game"], developmentCycle: "2026 年 8 月 4 日正式上线", note: "House House 的代表作履历与发行主体明确，但本项目具体分工、人数和成本未公开。", sources: [{ label: "Big Walk 官方", scope: "研发 / 发行主体 · 上线平台 · 合作人数", url: "https://bigwalk.game/faq/" }] },
  "集合！浆果镇": {
    studio: "《集合！浆果镇》项目组", company: "朝夕光年（字节跳动）", size: "历史项目约100人缩至约50人；当前规模未核实", previous: [],
    experience: "项目原代号 Block；国际服 JungoJam 是同项目的海外版本，不作为独立前作计数。",
    developmentCycle: "2025年3月海外软启动；2026年4月国内首曝，7月国内首测", cost: "未公开",
    note: "GRP #164披露历史团队缩编与制作团队变更，不能将50人当作当前精确人数。国内转向派对与生活模拟，与海外角色扮演版本分开评估。",
    sources: [{ label: "GRP #164（需企业权限）", scope: "历史团队规模 · 研发方向 · 国内外版本差异（2026-08-03）", url: "https://grp.woa.com/report.html?id=164" }],
  },
  "代号：Team2": {
    studio: "Glow Studio《代号：Team2》项目组", company: "字节跳动", organization: "朝夕光年 · Glow Studio", location: "广州", size: "未公开", previous: [],
    keyMembers: [{ role: "制作人", name: "李博睿" }],
    experience: "GRP #145 记录制作人曾任《决战！平安京》主数值策划；未披露项目组其他核心成员履历。",
    developmentCycle: "2025 年海外测试 · 2026 年 6 月国服首测", cost: "未公开",
    note: "GRP #145 已披露项目组所在地、制作人和版本迭代；团队规模与成本未披露。",
    sources: [{ label: "GRP 报告 #145", scope: "工作室 · 所在地 · 制作人 · 测试阶段", url: "https://grp.woa.com/report.html?id=145" }],
  },
};

function isUndisclosed(value?: string) {
  return !value || /^(未公开|公开未披露|待公开|待确认|研发团队待公开)$/.test(value.trim());
}

function disclosedValue(value?: string) {
  if (!value || isUndisclosed(value)) return "—";
  return value;
}

function PipelineTeamSection({ name, item }: { name: string; item: Record<string, unknown> }) {
  const fallbackDeveloper = typeof item.developer === "string" ? item.developer : undefined;
  const suppliedTeam = item.team;
  const researchedTeam = suppliedTeam && typeof suppliedTeam === "object" && "studio" in suppliedTeam && typeof suppliedTeam.studio === "string"
    ? suppliedTeam as PipelineTeamProfile
    : null;
  const profile = PIPELINE_TEAM_PROFILES[name] || researchedTeam || {
    studio: fallbackDeveloper || "研发团队待公开",
    size: "未公开",
    previous: [],
    note: "公开资料暂未披露团队规模和过往产品，本页不做厂商级外推。",
  };
  const previous = profile.previous.filter((product) => !isUndisclosed(product));
  const keyMembers = profile.keyMembers || [];
  const sources = profile.sources || (profile.sourceUrl ? [{ label: profile.sourceLabel || "公开资料", scope: "团队信息", url: profile.sourceUrl }] : []);
  return (
    <section className="pipeline-detail-section">
      <div className="section-heading heading-with-note"><div><p className="eyebrow">DEVELOPMENT TEAM &amp; COST</p><h3>研发团队与成本情况</h3></div><span>按团队级信源填入 · 未披露字段标明核查状态</span></div>
      <div className="pipeline-team-card">
        <div className="pipeline-team-intro"><div className="pipeline-team-mark">{disclosedValue(profile.studio).slice(0, 1)}</div><div><p>DEVELOPMENT OWNER</p><h4>{disclosedValue(profile.studio)}</h4><span>{profile.note}</span></div></div>
        <div className="pipeline-team-fields" role="list" aria-label="研发团队与成本字段">
          <div role="listitem"><b>所属公司</b><strong>{disclosedValue(profile.company)}</strong></div>
          <div role="listitem"><b>事业部 / 工作室</b><strong>{disclosedValue(profile.organization || profile.studio)}</strong></div>
          <div role="listitem"><b>团队所在地</b><strong>{disclosedValue(profile.location)}</strong></div>
          <div role="listitem"><b>团队规模</b><strong>{disclosedValue(profile.size)}</strong></div>
          <div className="pipeline-team-wide" role="listitem"><b>核心团队成员</b>{keyMembers.length ? <div className="pipeline-team-members">{keyMembers.map((member) => <span key={`${member.role}-${member.name}`}><i>{member.role}</i>{member.name}</span>)}</div> : <strong>—</strong>}</div>
          <div className="pipeline-team-wide" role="listitem"><b>过往产品与开发经验</b>{previous.length ? <div className="pipeline-team-products">{previous.map((product) => <span key={product}>{product}</span>)}</div> : <strong>—</strong>}{profile.experience && <p>{profile.experience}</p>}</div>
          <div className="pipeline-team-cycle" role="listitem"><b>研发周期与当前状态</b><strong>{disclosedValue(profile.developmentCycle)}</strong></div>
          <div role="listitem"><b>成本投入</b><strong>{disclosedValue(profile.cost)}</strong></div>
        </div>
      </div>
      {sources.length > 0 && <nav className="pipeline-team-sources" aria-label="研发团队信息信源"><span>团队信息信源</span><div className="pipeline-team-source-list">{sources.map((source) => (
        <a key={`${source.label}-${source.url}`} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><small>{source.scope}</small><i>↗</i></a>
      ))}</div></nav>}
    </section>
  );
}

function studioTierLabel(tier?: string) {
  return ({ T1_必追踪: "T1 · 必追踪", T2_应追踪: "T2 · 应追踪", T3_观察: "T3 · 观察" } as Record<string, string>)[tier || ""] || tier || "重点厂商";
}

function studioGroupLabel(name: string) {
  return name === "其他新品 / 观察样本" ? "其他厂商在研新品" : name;
}

function studioPipelineName(value: string) {
  return value.replace(/（[^）]*）\s*$/, "").trim();
}

function studioNewsArticles(studio: StudioRecord, bio?: StudioBio) {
  const articles = bio?.recent_articles || [];
  const products = [...(studio.known_published || []), ...(studio.known_pipeline || []).map(studioPipelineName), ...(studio.pool_games || [])];
  const productMatches = articles.filter((article) => products.some((product) => `${article.title || ""} ${article.summary || ""} ${(article.games_mentioned || []).join(" ")}`.includes(product)));
  const companyMatches = articles.filter((article) => `${article.title || ""} ${article.summary || ""}`.includes(studio.name));
  return [...new Set([...productMatches, ...companyMatches, ...articles])];
}

function StudioPipelineStrip({ studio, pipelineGameMap, pipelineIconMap, onOpenPipeline, compact = false }: {
  studio: StudioRecord;
  pipelineGameMap: Map<string, Game>;
  pipelineIconMap: DashboardData["pipelineIcons"];
  onOpenPipeline?: (name: string) => void;
  compact?: boolean;
}) {
  const projects = (studio.known_pipeline || []).map(studioPipelineName);
  return (
    <div className={`studio-pipeline-strip ${compact ? "compact" : ""}`} aria-label={`${studio.name}在研新品`}>
      <div className="studio-pipeline-strip-head"><b>在研新品</b><span>{projects.length} 款</span></div>
      {projects.length ? <div className="studio-pipeline-products">{projects.map((name) => {
        const knownGame = pipelineGameMap.get(name);
        const project = { ...knownGame, name, icon_path: knownGame?.icon_path || pipelineIconMap[name]?.path };
        const content = <><GameIcon game={project} className="studio-pipeline-icon" /><span className="studio-pipeline-product-copy"><strong>{name}</strong><small>{knownGame?.category || "在研项目"}</small></span><em>在研</em></>;
        return onOpenPipeline && pipelineIconMap[name] ? <button onClick={() => onOpenPipeline(name)} key={name}>{content}</button> : <div key={name}>{content}</div>;
      })}</div> : <p className="studio-pipeline-empty">当前样本暂无明确在研项目</p>}
    </div>
  );
}

function StudioPublishedStrip({ studio, pipelineGameMap, onOpenGame, compact = false }: {
  studio: StudioRecord;
  pipelineGameMap: Map<string, Game>;
  onOpenGame: (game: Game) => void;
  compact?: boolean;
}) {
  const products = studio.known_published || [];
  return (
    <div className={`studio-pipeline-strip studio-published-strip ${compact ? "compact" : ""}`} aria-label={`${studio.name}已发产品`}>
      <div className="studio-pipeline-strip-head"><b>已发产品</b><span>{products.length} 款</span></div>
      {products.length ? <div className="studio-pipeline-products">{products.map((name) => {
        const game = pipelineGameMap.get(name);
        const content = compact
          ? <GameIcon game={game || { name }} className="studio-pipeline-icon" />
          : <><GameIcon game={game || { name }} className="studio-pipeline-icon" /><span className="studio-pipeline-product-copy"><strong>{name}</strong><small>{game?.category || "已发产品"}</small></span><em>已发</em></>;
        return game ? <button onClick={() => onOpenGame(game)} aria-label={`查看${name}游戏详情`} title={name} key={name}>{content}</button> : <div title={name} key={name}>{content}</div>;
      })}</div> : <p className="studio-pipeline-empty">当前样本暂无已发产品</p>}
    </div>
  );
}

function StudioCard({ studio, index, overseas = false, bio, pipelineGameMap, pipelineIconMap, onOpenStudio, onOpenPipeline, onOpenGame }: {
  studio: StudioRecord;
  index: number;
  overseas?: boolean;
  bio?: StudioBio;
  pipelineGameMap: Map<string, Game>;
  pipelineIconMap: DashboardData["pipelineIcons"];
  onOpenStudio: (name: string) => void;
  onOpenPipeline: (name: string) => void;
  onOpenGame: (game: Game) => void;
}) {
  const published = studio.known_published || [];
  const pipeline = studio.known_pipeline || [];
  const samples = studio.pool_games || [];
  const recent = studioNewsArticles(studio, bio).slice(0, 3);
  const sampleCount = overseas ? samples.length : published.length;
  const researchCount = overseas ? 0 : pipeline.length;
  const primarySummary = studio.track_focus || bio?.summary || "持续跟踪重点厂商动向";
  const summary = bio?.summary && bio.summary.trim() !== primarySummary.trim() ? bio.summary : "";
  const business = studio.business_profile;
  return (
    <article className={`studio-card studio-card-dense ${overseas ? "studio-card-overseas" : ""}`}>
      <header className="studio-card-head">
        <div className="studio-card-identity">
          <div className={`studio-avatar ${overseas ? "overseas" : ""}`}>{studio.name.slice(0, 1)}</div>
          <div className="studio-body">
            <div className="studio-title"><button className="studio-name-link" onClick={() => onOpenStudio(studio.name)}><strong>{studio.name}</strong><i>进入详情 →</i></button><span className="studio-tier">{overseas ? studioTierLabel(studio.tier) : `CN · 0${index + 1}`}</span></div>
            <p>{primarySummary}</p>
            {summary && <small className="studio-bio-summary">{summary}</small>}
          </div>
        </div>
      </header>

      {overseas && business ? <div className="studio-overseas-business">
        <dl>
          <div><dt>{business.fiscal_year} 营收</dt><dd>{business.revenue}</dd><small>{business.revenue_note}</small></div>
          <div><dt>EBITDA / 利润</dt><dd>{business.ebitda}</dd><small>{business.ebitda_note}</small></div>
          <div><dt>团队规模</dt><dd>{business.headcount}</dd><small>{business.headcount_note}</small></div>
        </dl>
        <div className="studio-overseas-games"><b>热门游戏 · 仅看板收录</b><div>{business.top_games.length ? business.top_games.map((name) => { const game = pipelineGameMap.get(name); return game ? <button onClick={() => onOpenGame(game)} aria-label={`查看${name}游戏详情`} key={name}><GameIcon game={game} className="studio-business-game-icon" /><strong>{name}</strong></button> : <span key={name}><GameIcon game={{ name }} className="studio-business-game-icon" /><strong>{name}</strong></span>; }) : <em>当前看板暂无对应样本</em>}</div><a href={business.source_url} target="_blank" rel="noreferrer">{business.source_label} ↗</a></div>
      </div> : <><div className="studio-stat-row">
        <span><b>{sampleCount || "—"}</b>{overseas ? "样本产品" : "已发产品"}</span>
        <span><b>{researchCount || "—"}</b>{overseas ? "在研储备" : "在研储备"}</span>
      </div>

      {!overseas && <StudioPublishedStrip studio={studio} pipelineGameMap={pipelineGameMap} onOpenGame={onOpenGame} />}
      {overseas && <div className="studio-lists studio-lists-dense"><div><b>样本产品</b><span className="studio-product-list">{samples.length ? samples.map((product) => { const game = pipelineGameMap.get(product); return game ? <button onClick={() => onOpenGame(game)} aria-label={`查看${product}游戏详情`} key={product}>{product}</button> : <i key={product}>{product}</i>; }) : <em>持续补充</em>}</span></div></div>}

      {!overseas && <StudioPipelineStrip studio={studio} pipelineGameMap={pipelineGameMap} pipelineIconMap={pipelineIconMap} onOpenPipeline={onOpenPipeline} />}</>}

      {recent.length > 0 && <div className="studio-news"><div className="studio-news-head"><b>近期媒体情报</b><span>最近 {recent.length} 条</span></div>{recent.map((article, articleIndex) => <a href={article.url || "#"} target="_blank" rel="noreferrer" key={`${article.title}-${articleIndex}`}><time>{String(article.date || "—").slice(0, 10)}</time><strong>{article.title || "公开动态"}</strong><small>{article.source || "公开资料"}</small></a>)}</div>}
    </article>
  );
}

const FOCUS_TEAM_STUDIOS = new Set(["腾讯", "网易", "米哈游", "莉莉丝", "字节（朝夕光年）"]);

function isUndisclosedTeamValue(value?: string) {
  return !value || /未披露|未公开|待确认/.test(value);
}

function compactTeamValue(value?: string, fallback = "未公开") {
  return isUndisclosedTeamValue(value) ? fallback : value;
}

function StudioFocusTeamMap({ studio, pipelineGameMap, onOpenPipeline, onOpenGame }: {
  studio: StudioRecord;
  pipelineGameMap: Map<string, Game>;
  onOpenPipeline: (name: string) => void;
  onOpenGame: (game: Game) => void;
}) {
  const pipelineRows = (studio.known_pipeline || []).map((entry) => {
    const project = studioPipelineName(entry);
    const game = pipelineGameMap.get(project);
    const profile = PIPELINE_TEAM_PROFILES[project] || game?.pipeline_team;
    const previous = (profile?.previous || []).filter((name) => !isUndisclosedTeamValue(name));
    const leaders = (profile?.keyMembers || []).filter((leader) => !isUndisclosedTeamValue(leader.name));
    const sources = profile?.sources?.length ? profile.sources : profile?.sourceUrl ? [{ label: profile.sourceLabel || "公开信源", scope: "团队信息", url: profile.sourceUrl }] : [];
    return { project, profile, game, previous, leaders, sources, kind: "在研项目" as const };
  });
  const releasedRows = (studio.known_published || []).flatMap((project) => {
    const game = pipelineGameMap.get(project);
    const development = game?.development_profile;
    if (!game || !development?.team) return [];
    const previous = (development.prior_experience?.match(/《[^》]+》/g) || []).filter((name) => name !== `《${project}》`).slice(0, 3);
    const producer = development.producer?.trim();
    const profile: PipelineTeamProfile = {
      studio: development.team,
      company: development.company,
      organization: development.team_note,
      size: development.early_team_size || "未公开",
      previous,
      keyMembers: producer && producer !== "未公开" ? [{ role: "制作人 / 主策", name: producer }] : [],
      developmentCycle: development.development_cycle,
      note: development.team_note || "公开信息仅确认产品与研发团队归属。",
      sources: (development.sources || []).map((source) => ({ label: source.label, scope: source.note || "研发团队归属", url: source.url })),
    };
    return [{ project, profile, game, previous, leaders: profile.keyMembers || [], sources: profile.sources || [], kind: "热门产品" as const }];
  });
  const rows = [...pipelineRows, ...releasedRows];

  return (
    <section className="studio-focus-team-map" aria-label={`${studio.name}重点研发团队地图`}>
      <header>
        <div><p className="eyebrow">FOCUS TEAM MAP</p><h3>关注品类研发团队</h3><span>汇总重点在研项目与热门已发产品对应的工作室、团队规模、负责人和已核验履历。</span></div>
      </header>
      <div className="studio-team-table" role="table" aria-label={`${studio.name}研发团队汇总`}>
        <div className="studio-team-row studio-team-head" role="row"><span>团队</span><span>对应项目</span><span>关注方向</span><span>团队人数</span><span>负责人</span><span>过往明星产品</span><span>信源</span></div>
        {rows.map(({ project, profile, game, previous, leaders, sources, kind }) => (
          <article className="studio-team-row" role="row" key={project}>
            <div className="studio-team-name"><small>团队</small><strong>{profile?.studio || `${project}项目组`}</strong><span>{profile?.organization || "具体组织归属未公开"}</span></div>
            <div className="studio-team-project-cell"><small>{kind}</small><GameIcon game={game || { name: project }} className="studio-team-project-icon" /><button onClick={() => kind === "热门产品" && game ? onOpenGame(game) : onOpenPipeline(project)}>{project} →</button></div>
            <div className="studio-team-direction"><b>{game?.category || "待归类"}</b><span>{game?.release_status || game?.status || "在研跟踪"}</span></div>
            <div className="studio-team-field"><small>团队人数</small><strong>{compactTeamValue(profile?.size)}</strong></div>
            <div className="studio-team-field"><small>负责人</small>{leaders.length ? <span className="studio-team-leaders">{leaders.map((leader) => <b key={`${leader.role}-${leader.name}`}><i>{leader.role}</i>{leader.name}</b>)}</span> : <strong>未公开</strong>}</div>
            <div className="studio-team-field"><small>过往明星产品</small>{previous.length ? <span className="studio-team-previous">{previous.map((name) => <b key={name}>{name}</b>)}</span> : <strong>未确认</strong>}</div>
            <div className="studio-team-source-links">{sources.length ? sources.slice(0, 2).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`${project}-${source.label}`}>{source.label} ↗</a>) : <span>待补充</span>}</div>
          </article>
        ))}
      </div>
      <footer>“过往明星产品”仅采用同工作室、原班团队或明确组织口径；只有厂商级关联但无法确认同一团队的产品不计入。</footer>
    </section>
  );
}

function StudioFinancialHistory({ business }: { business: NonNullable<StudioRecord["business_profile"]> }) {
  const history = [...(business.financial_history || [])].sort((a, b) => Number(a.year) - Number(b.year));
  if (history.length < 2) return null;

  const maxValue = Math.max(...history.flatMap((item) => [item.revenue_eur_b, item.ebitda_eur_b]), 1);
  const first = history[0];
  const latest = history[history.length - 1];
  const revenueChange = ((latest.revenue_eur_b / first.revenue_eur_b) - 1) * 100;
  const latestMargin = (latest.ebitda_eur_b / latest.revenue_eur_b) * 100;
  const formatBillions = (value: number) => `€${value.toFixed(value >= 1 ? 2 : 3)}B`;

  return (
    <section className="studio-financial-history studio-detail-section" aria-label="历年营收与 EBITDA 变化">
      <header>
        <div><p className="eyebrow">FINANCIAL TREND</p><h3>近五年营收与 EBITDA</h3></div>
        <div className="studio-financial-legend" aria-label="图例"><span className="revenue">营收</span><span className="ebitda">EBITDA</span></div>
      </header>
      <div className="studio-financial-layout">
        <div className="studio-financial-chart" role="img" aria-label={`${first.year} 至 ${latest.year} 年营收与 EBITDA 柱状图，单位为十亿欧元`}>
          <div className="studio-financial-scale" aria-hidden="true"><span>€{maxValue.toFixed(1)}B</span><span>€{(maxValue / 2).toFixed(1)}B</span><span>€0</span></div>
          <div className="studio-financial-years">
            {history.map((item) => (
              <div className="studio-financial-year" key={item.year}>
                <div className="studio-financial-bars">
                  <i className="revenue" style={{ height: `${(item.revenue_eur_b / maxValue) * 100}%` }} title={`${item.year} 营收 ${formatBillions(item.revenue_eur_b)}`}><span>{formatBillions(item.revenue_eur_b)}</span></i>
                  <i className="ebitda" style={{ height: `${(item.ebitda_eur_b / maxValue) * 100}%` }} title={`${item.year} EBITDA ${formatBillions(item.ebitda_eur_b)}`}><span>{formatBillions(item.ebitda_eur_b)}</span></i>
                </div>
                <strong>{item.year}</strong>
                <small className={item.basis ? "adjusted" : ""}>{item.basis || "官方披露"}</small>
              </div>
            ))}
          </div>
          <footer><span>单位：十亿欧元</span><p><b>口径提示：</b>2024 年为官方“不含递延”口径；其余年份为当年官方披露值，跨年变化用于趋势观察。</p></footer>
        </div>
        <aside className="studio-financial-insight">
          <span>五年观察</span>
          <strong>{revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(0)}%</strong>
          <p>2021–2023 连续回落，2024 明显反弹，2025 营收仍处历史高位。</p>
          <dl><div><dt>{latest.year} EBITDA 率</dt><dd>{latestMargin.toFixed(1)}%</dd></div><div><dt>{latest.year} EBITDA</dt><dd>{formatBillions(latest.ebitda_eur_b)}</dd></div></dl>
          <nav aria-label="历年经营数据官方信源"><span>官方信源</span>{history.map((item) => <a href={item.source_url} target="_blank" rel="noreferrer" key={item.year}>{item.year} ↗</a>)}</nav>
        </aside>
      </div>
    </section>
  );
}

function StudioDetailPage({ studio, bio, pipelineGameMap, pipelineIconMap, onBack, onOpenPipeline, onOpenGame }: {
  studio: StudioRecord;
  bio?: StudioBio;
  pipelineGameMap: Map<string, Game>;
  pipelineIconMap: DashboardData["pipelineIcons"];
  onBack: () => void;
  onOpenPipeline: (name: string) => void;
  onOpenGame: (game: Game) => void;
}) {
  const published = studio.known_published || studio.pool_games || [];
  const pipeline = studio.known_pipeline || [];
  const recent = studioNewsArticles(studio, bio).slice(0, 8);
  const performanceSignals = recent.filter((article) => article.type === "performance");
  const business = studio.business_profile;
  const showFocusTeamMap = FOCUS_TEAM_STUDIOS.has(studio.name);
  return (
    <section className="workspace studio-detail-page" aria-label={`${studio.name}厂商详情`}>
      <button className="back-overview" onClick={onBack}><span>←</span> 返回上一页</button>
      <header className="studio-detail-header"><div className="studio-avatar">{studio.name.slice(0, 1)}</div><div><p className="eyebrow">STUDIO INTELLIGENCE</p><h2>{studio.name}</h2><span>{studio.track_focus || studio.reason || "持续跟踪休闲互动产品布局"}</span></div></header>

      {showFocusTeamMap ? <StudioFocusTeamMap studio={studio} pipelineGameMap={pipelineGameMap} onOpenPipeline={onOpenPipeline} onOpenGame={onOpenGame} /> : <>
        <section className="studio-detail-overview"><div className="studio-detail-stats">{business ? <><article><span>{business.fiscal_year} 营收</span><strong>{business.revenue}</strong><small>{business.revenue_note}</small></article><article><span>EBITDA</span><strong>{business.ebitda}</strong><small>{business.ebitda_note}</small></article><article><span>团队规模</span><strong>{business.headcount}</strong><small>{business.headcount_note}</small></article><article><span>月活用户</span><strong>{business.monthly_active_users || "—"}</strong><small>{business.source_label}</small></article></> : <><article><span>已发产品</span><strong>{published.length}</strong><small>当前看板样本</small></article><article><span>在研储备</span><strong>{pipeline.length}</strong><small>公开项目</small></article><article><span>新闻报告</span><strong>{bio?.article_count || 0}</strong><small>关联媒体情报</small></article><article><span>业绩信号</span><strong>{performanceSignals.length || "—"}</strong><small>近期公开报道</small></article></>}</div><div className="studio-detail-thesis"><b>当前观察</b><p>{bio?.summary || studio.track_focus || studio.reason || "持续跟踪产品组合、研发方向与经营信号。"}</p><small>{business ? <a href={business.source_url} target="_blank" rel="noreferrer">{business.source_label} ↗</a> : "财务业绩、团队规模与组织归属仅在存在可核验公开口径时展示。"}</small></div></section>

        {business && <StudioFinancialHistory business={business} />}

        <div className="studio-detail-grid">
          <section className="studio-detail-section"><header><p className="eyebrow">PRODUCT PORTFOLIO</p><h3>产品组合</h3></header><div className="studio-detail-tags">{published.length ? published.map((name) => { const game = pipelineGameMap.get(name); return game ? <button onClick={() => onOpenGame(game)} aria-label={`查看${name}游戏详情`} key={name}>{name}</button> : <span key={name}>{name}</span>; }) : <p>当前样本暂无已发产品。</p>}</div></section>
          <section className="studio-detail-section"><header><p className="eyebrow">ORGANIZATION &amp; TEAM</p><h3>组织与团队</h3></header><dl><div><dt>团队规模</dt><dd>{business?.headcount || "待权威公开信源补充"}</dd></div><div><dt>团队口径</dt><dd>{business?.headcount_note || "按工作室 / 项目组继续核验"}</dd></div></dl></section>
        </div>

        <section className="studio-detail-section studio-detail-pipeline"><header><div><p className="eyebrow">R&amp;D PIPELINE</p><h3>在研方向</h3></div><span>点击产品进入在研新品详情</span></header><StudioPipelineStrip studio={studio} pipelineGameMap={pipelineGameMap} pipelineIconMap={pipelineIconMap} onOpenPipeline={onOpenPipeline} /></section>
      </>}

      <section className="studio-detail-section studio-detail-news"><header><div><p className="eyebrow">BUSINESS SIGNALS</p><h3>近期经营信号与新闻报告</h3></div><span>{recent.length} 条近期信源</span></header>{recent.length ? <div>{recent.map((article, index) => <a href={article.url || "#"} target="_blank" rel="noreferrer" key={`${article.title}-${index}`}><time>{String(article.date || "—").slice(0, 10)}</time><span><b>{article.type === "performance" ? "经营业绩" : "新闻报告"}</b><strong>{readableHeadline(article.title || "公开动态")}</strong>{article.summary && <p>{readableHeadline(article.summary)}</p>}</span><em>{article.source || "公开资料"} ↗</em></a>)}</div> : <p className="empty">暂无近期可核验报道。</p>}</section>
    </section>
  );
}

function isReleasedProduct(game: Game) {
  if (verifiedReleases[game.name]?.date <= currentDateKey()) return true;
  return [game.release_status, game.status].some((value) => /已上线|公测|活跃|运营中/.test(String(value || "")));
}

function productMilestones(game: Game) {
  if (game.track === "新品发现") return [];
  const released = isReleasedProduct(game);
  if ((game.intelligence?.recent_updates || []).length) {
    const articles = game.intelligence?.recent_articles || [];
    return sortTimeline([...game.intelligence.recent_updates].map((item: Record<string, any>) => {
      const copy = `${item.version || ""} ${item.summary || ""}`;
      const type = released ? liveOpsType(item) : timelineType(copy);
      const related = articles.find((article: Record<string, any>) => String(article.date || "").slice(0, 7) === String(item.date || "").slice(0, 7) && [article.title, article.summary].some((value) => String(value || "").includes(String(item.version || "").split(" ")[0])));
      return {
        ...item,
        type,
        title: item.version || (type === "玩法变化" ? "核心玩法变化" : type === "版本更新" ? "版本更新" : "重要研发节点"),
        summary: item.summary || "公开资料记录了该产品的阶段变化。",
        url: item.url || related?.url,
      };
    }));
  }
  if (!released && game.name === "蛋仔派对") return [
    { date: "2020-12", type: "立项阶段", title: "项目进入研发", summary: "制作人披露公测时总研发周期约一年半，据此推算项目约在 2020 年末启动；精确立项日未公开。", source: "制作人采访", url: "https://www.sohu.com/a/552304023_118576", status: "estimated" },
    { date: "2021-02-06", type: "首次测试", title: "首次全平台不限号删档测试", summary: "产品第一次面向用户验证派对闯关、多人互动与基础内容框架。", source: "公开测试记录", url: "https://m.3839.com/a/130117.htm" },
    { date: "2021-06-11", type: "重大测试", title: "“领潮测试”开启", summary: "加入排位、限时玩法和地图创作等内容，UGC与长线运营框架进一步成形。", source: "TapTap 官方社区", url: "https://www.taptap.cn/moment/152020087950281527" },
    { date: "2021-07-22", type: "版号节点", title: "国产网络游戏版号获批", summary: "获得移动端发行资质，出版物号 ISBN 978-7-498-09309-7。", source: "国家新闻出版署", url: "https://www.nppa.gov.cn/bsfw/jggs/yxspjg/gcwlyxspxx/index_3.html" },
    { date: "2022-05-27", type: "公测上线", title: "中国大陆全平台公测", summary: "Android 与 iOS 正式上线，产品由测试期转入商业化运营阶段。", source: "网易游戏 / TapTap", url: "https://www.taptap.cn/app/206776" },
  ];
  const sixMonthsStart = shiftMonth(currentDateKey(), -6);
  const articles = (game.intelligence?.recent_articles || [])
    .filter((article: Record<string, any>) => article.type !== "官方更新" && dateKey(article.date) >= sixMonthsStart)
    .map((article: Record<string, any>) => {
      const text = `${article.title || ""} ${article.summary || ""} ${article.type || ""}`;
      return {
        ...article,
        type: released ? liveOpsType(article) : timelineType(text),
        title: article.title || "公开产品动态",
        summary: article.summary || `公开信源记录：${article.title || "该产品出现新的公开动态"}。`,
      };
    });
  const relevant = articles.filter((article: Record<string, any>) => released ? article.type !== "公开动态" : article.type !== "阶段证据");
  return sortTimeline((relevant.length ? relevant : articles).slice(-6));
}

type ProductIntelEntry = {
  date: string;
  label: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  mediaUrl?: string;
  mediaSource?: string;
  mediaTitle?: string;
  mediaIsSearch?: boolean;
};

type ProductIntelColumn = {
  id: "version" | "gameplay" | "reports";
  index: string;
  title: string;
  description: string;
  items: ProductIntelEntry[];
};

const MAJOR_VERSION_PATTERN = /版本|赛季|season|周年|大型更新|重大更新|\bS\d+|盛典季|派对季|\bv\d/i;
const SPECIFIC_GAMEPLAY_PATTERN = /新玩法|玩法(?:上新|更新|开放|加入|推出)|新模式|模式(?:上线|开放|新增)|新地图|新关卡|新副本|新机制|机制(?:更新|重构)|新增.{0,12}(?:玩法|模式|地图|关卡|副本|机制)|放置模拟经营|离线(?:自动)?经营|好友摆摊|经营玩法|家园编辑|创作模式|UGC|工坊(?:模式|编辑器)|钓鱼玩法/i;
const GAMEPLAY_MEDIA_PATTERN = /玩法|模式|机制|实机|测评|评测|攻略|强度|guide/i;
const PATCH_LEVEL_UPDATE_PATTERN = /不停服更新|版本更新|新版本/i;
const UPDATE_ARTICLE_PATTERN = /不停服更新|版本更新|新赛季|新版本|赛季.{0,8}(?:开启|上线)|联动.{0,12}(?:开启|上线)|活动.{0,8}(?:开启|上线)|新增.{0,12}(?:玩法|模式|地图|关卡|副本)/i;
const MINOR_CONTENT_PATTERN = /外观|皮肤|时装|返场|抽奖|礼包/i;
const AUTHORITATIVE_REPORT_SOURCE_PATTERN = /GRP|内部|DataBrain|GameLook|游戏茶馆|游戏葡萄|触乐|游研社|竞核|游戏日报|17173|IGN|PC Gamer|Polygon|Eurogamer|GameSpot|篝火营地|手游那点事|游戏那点事|白鲸出海|Enjoy出海/i;

function productIntelEntry(item: Record<string, unknown>, label: string): ProductIntelEntry {
  return {
    date: recordText(item, "date"),
    label,
    title: recordText(item, "title") || recordText(item, "version") || "公开产品动态",
    summary: recordText(item, "summary") || recordText(item, "description"),
    source: recordText(item, "source") || recordText(item, "platform") || "公开资料",
    url: recordText(item, "url") || undefined,
    mediaUrl: recordText(item, "gameplay_video_url") || undefined,
    mediaSource: recordText(item, "gameplay_video_source") || undefined,
    mediaTitle: recordText(item, "gameplay_video_title") || undefined,
  };
}

function productIntelKey(item: ProductIntelEntry) {
  return item.url || `${dateKey(item.date)}|${item.title.replace(/\s+/g, "")}`;
}

function sortProductIntel(items: ProductIntelEntry[]) {
  return [...items].sort((a, b) => (dateKey(b.date) || "0000-00-00").localeCompare(dateKey(a.date) || "0000-00-00"));
}

function productIntelDateDistance(a: string, b: string) {
  const aTime = Date.parse(dateKey(a));
  const bTime = Date.parse(dateKey(b));
  return Number.isFinite(aTime) && Number.isFinite(bTime) ? Math.abs(aTime - bTime) / 86_400_000 : Number.POSITIVE_INFINITY;
}

function productIntelGrams(text: string) {
  const normalized = text.toLowerCase().replace(/版本更新|重大版本|公开动态|内容运营|玩法更新/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) grams.add(normalized.slice(index, index + 2));
  return grams;
}

function productIntelSimilarity(a: string, b: string) {
  const aGrams = productIntelGrams(a);
  const bGrams = productIntelGrams(b);
  if (!aGrams.size || !bGrams.size) return 0;
  let shared = 0;
  aGrams.forEach((gram) => { if (bGrams.has(gram)) shared += 1; });
  return shared / Math.min(aGrams.size, bGrams.size);
}

function productIntelText(item: Record<string, unknown>) {
  return `${recordText(item, "type")} ${recordText(item, "title")} ${recordText(item, "version")} ${recordText(item, "summary")}`;
}

function isProductUpdateArticle(article: Record<string, unknown>) {
  const text = productIntelText(article);
  return MAJOR_VERSION_PATTERN.test(text) || SPECIFIC_GAMEPLAY_PATTERN.test(text) || UPDATE_ARTICLE_PATTERN.test(text);
}

function isAuthoritativeReport(article: Record<string, unknown>) {
  return AUTHORITATIVE_REPORT_SOURCE_PATTERN.test(recordText(article, "source")) || /内部报告|GRP/.test(recordText(article, "type"));
}

function productIntelSummaryParts(summary: string) {
  return summary.split(/[；。，]/).map((part) => part.trim()).filter(Boolean);
}

function versionFocusedEntry(entry: ProductIntelEntry) {
  const parts = productIntelSummaryParts(entry.summary);
  const gameplayParts = parts.filter((part) => SPECIFIC_GAMEPLAY_PATTERN.test(part));
  const versionParts = parts.filter((part) => !SPECIFIC_GAMEPLAY_PATTERN.test(part));
  const focus = (versionParts.length ? versionParts : parts).slice(0, 3).join("；");
  if (!focus) return entry;
  const prefix = entry.label === "赛季更新" ? "本赛季主要包含" : "本次版本主要包含";
  return { ...entry, summary: `${prefix}：${focus}。${gameplayParts.length ? "新增玩法另见“玩法更新”栏目。" : ""}` };
}

function gameplayFeatureEntry(entry: ProductIntelEntry) {
  const parts = entry.summary.split(/[；。，]/).map((part) => part.trim()).filter(Boolean);
  const gameplayParts = parts.filter((part) => SPECIFIC_GAMEPLAY_PATTERN.test(part));
  if (!gameplayParts.length) return null;
  return {
    ...entry,
    label: "玩法更新",
    title: gameplayParts[0],
    summary: `玩法相关变化：${gameplayParts.join("；")}。${entry.url ? "与对应版本更新共用同一信源。" : ""}`,
  };
}

function productIntelligenceColumns(game: Game): ProductIntelColumn[] {
  const version: ProductIntelEntry[] = [];
  const gameplay: ProductIntelEntry[] = [];
  const reports: ProductIntelEntry[] = [];
  const articles = recordList(game.intelligence?.recent_articles);
  const consumedArticles = new Set<string>();
  const used = new Set<string>();
  const add = (target: ProductIntelEntry[], entry: ProductIntelEntry) => {
    const column = target === version ? "version" : target === gameplay ? "gameplay" : "reports";
    const key = `${column}|${productIntelKey(entry)}`;
    if (used.has(key)) return;
    used.add(key);
    target.push(entry);
  };

  productMilestones(game).forEach((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    const text = productIntelText(item);
    const related = articles
      .filter((article) => recordText(article, "type") !== "官方更新" && !consumedArticles.has(productIntelKey(productIntelEntry(article, "媒体报告"))) && isProductUpdateArticle(article) && productIntelDateDistance(recordText(item, "date"), recordText(article, "date")) <= 8)
      .map((article) => ({ article, score: productIntelSimilarity(text, productIntelText(article)) }))
      .filter(({ score }) => score >= .1)
      .sort((a, b) => b.score - a.score)[0]?.article;
    const baseEntry = productIntelEntry(item, recordText(item, "type") || "重大版本");
    const relatedEntry = related ? productIntelEntry(related, baseEntry.label) : null;
    if (relatedEntry) consumedArticles.add(productIntelKey(relatedEntry));
    const entry = relatedEntry ? {
      ...baseEntry,
      title: /^(版本更新|核心玩法变化|重要研发节点|公开产品动态)$/.test(baseEntry.title) ? relatedEntry.title : baseEntry.title,
      source: relatedEntry.source,
      url: relatedEntry.url || baseEntry.url,
      mediaUrl: relatedEntry.mediaUrl || baseEntry.mediaUrl,
      mediaSource: relatedEntry.mediaSource || baseEntry.mediaSource,
      mediaTitle: relatedEntry.mediaTitle || baseEntry.mediaTitle,
    } : baseEntry;
    if (MAJOR_VERSION_PATTERN.test(text) || PATCH_LEVEL_UPDATE_PATTERN.test(text)) {
      const versionEntry = { ...entry, label: /赛季|\bS\d+|season|盛典季|派对季/i.test(text) ? "赛季更新" : "版本更新" };
      add(version, versionFocusedEntry(versionEntry));
      const gameplayFeature = gameplayFeatureEntry(entry);
      if (gameplayFeature) add(gameplay, gameplayFeature);
    } else if (SPECIFIC_GAMEPLAY_PATTERN.test(text)) {
      add(gameplay, gameplayFeatureEntry(entry) || { ...entry, label: "玩法更新" });
    }
  });

  articles.forEach((article) => {
    const text = productIntelText(article);
    const articleEntry = productIntelEntry(article, "媒体报告");
    if (consumedArticles.has(productIntelKey(articleEntry))) return;
    if (recordText(article, "type") === "官方更新") {
      add(reports, { ...articleEntry, label: "官方更新" });
      return;
    }
    if (game.track === "新品发现" && recordText(article, "source") === "游研所") {
      add(reports, { ...articleEntry, label: "新品报道" });
      return;
    }
    if (MAJOR_VERSION_PATTERN.test(text) || PATCH_LEVEL_UPDATE_PATTERN.test(text)) {
      const versionEntry = { ...articleEntry, label: /赛季|\bS\d+|season|盛典季|派对季/i.test(text) ? "赛季更新" : "版本更新" };
      add(version, versionFocusedEntry(versionEntry));
      const gameplayFeature = gameplayFeatureEntry(articleEntry);
      if (gameplayFeature) add(gameplay, gameplayFeature);
    } else if (SPECIFIC_GAMEPLAY_PATTERN.test(text) && isProductUpdateArticle(article)) {
      add(gameplay, gameplayFeatureEntry(articleEntry) || { ...articleEntry, label: "玩法更新" });
    } else if (UPDATE_ARTICLE_PATTERN.test(text) && !MINOR_CONTENT_PATTERN.test(text)) {
      add(version, versionFocusedEntry({ ...articleEntry, label: "重大版本" }));
    } else if (isAuthoritativeReport(article) || (/^游研所收录(?:公众号| · .+)$/.test(recordText(article, "source")) && recordText(article, "type") === "公众号报道")) {
      add(reports, articleEntry);
    }
  });

  const videos = recordList(game.intelligence?.videos).filter((video) => GAMEPLAY_MEDIA_PATTERN.test(`${recordText(video, "type")} ${recordText(video, "title")}`));
  gameplay.forEach((entry) => {
    if (entry.mediaUrl) return;
    const relatedVideo = videos
      .map((video) => ({ video, score: productIntelSimilarity(`${entry.title} ${entry.summary}`, `${recordText(video, "type")} ${recordText(video, "title")}`) }))
      .filter(({ video, score }) => score >= .1 && productIntelDateDistance(entry.date, recordText(video, "date")) <= 90)
      .sort((a, b) => b.score - a.score)[0]?.video;
    if (relatedVideo) {
      entry.mediaUrl = recordText(relatedVideo, "url") || undefined;
      entry.mediaSource = recordText(relatedVideo, "platform") || recordText(relatedVideo, "source") || "实机 / 测评";
      entry.mediaTitle = recordText(relatedVideo, "title") || undefined;
    } else {
      entry.mediaUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${game.name} ${entry.title} 实机`)}`;
      entry.mediaSource = "查找相关实机";
      entry.mediaIsSearch = true;
    }
  });

  return [
    { id: "version", index: "01", title: "重大版本更新", description: "新赛季、周年版本与大型内容更新", items: sortProductIntel(version).slice(0, 4) },
    { id: "gameplay", index: "02", title: "玩法更新", description: "核心玩法之外的新模式与机制变化", items: sortProductIntel(gameplay).slice(0, 4) },
    { id: "reports", index: "03", title: "媒体报道与研判", description: "权威媒体报告、新品报道及官方更新", items: sortProductIntel(reports).slice(0, 4) },
  ];
}

function ProductIntelligenceBoard({ game }: { game: Game }) {
  const columns = productIntelligenceColumns(game);
  return (
    <section className="detail-section product-intelligence-board" aria-label="近期版本、玩法与权威报告">
      <div className="section-heading heading-with-note product-intelligence-heading"><div><p className="eyebrow">PRODUCT INTELLIGENCE</p><h3>近期版本、玩法与研判</h3></div><span>运营更新近半年 · 报告取最新 · 按事件性质归类</span></div>
      <div className="product-intelligence-columns">
        {columns.map((column) => (
          <article className={`product-intelligence-column ${column.id}`} key={column.id}>
            <header><span>{column.index}</span><div><h4>{column.title}</h4><p>{column.description}</p></div><b>{column.items.length}</b></header>
            <div className="product-intelligence-list">
              {column.items.length ? column.items.map((item, index) => (
                <article key={`${column.id}-${productIntelKey(item)}-${index}`}>
                  <div className="product-intelligence-meta"><time>{shortDate(item.date) || "日期待核"}</time><span>{item.label}</span></div>
                  <h5>{item.title}</h5>
                  {item.summary && item.summary !== item.title && <p>{item.summary}</p>}
                  <footer><small>{item.source}</small>{item.mediaUrl && <a href={item.mediaUrl} target="_blank" rel="noreferrer" title={item.mediaTitle}>{item.mediaIsSearch ? "查找相关实机" : `实机：${item.mediaSource || "视频"}`} ↗</a>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">查看信源 ↗</a>}</footer>
                </article>
              )) : <p className="product-intelligence-empty">暂未收录可核验内容</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GameIcon({ game, className = "" }: { game: Game; className?: string }) {
  const configuredIconPath = resolveGameIconPath(game.name, game.icon_path, supplementalIcons);
  const iconPath = configuredIconPath ? publicAssetUrl(configuredIconPath) : undefined;
  const iconStyle = iconPath ? ({ "--icon-image": `url("${iconPath}")` } as CSSProperties) : undefined;
  return (
    <span className={`game-icon ${className}`} style={iconStyle} aria-hidden="true">
      <span>{game.name.slice(0, 1)}</span>
      {iconPath && (
        <img
          src={iconPath}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.parentElement?.style.removeProperty("--icon-image");
            event.currentTarget.remove();
          }}
        />
      )}
    </span>
  );
}

function StructuredProductAssessment({ assessment }: { assessment: StructuredAssessment }) {
  const evidenceCount = new Set([...assessment.strengths, ...assessment.risks].flatMap((item) => item.evidence_refs || [])).size;
  return (
    <section className="pipeline-detail-section structured-assessment" aria-label="结构化产品研判">
      <div className="section-heading heading-with-note assessment-heading"><div><p className="eyebrow">PRODUCT ASSESSMENT</p><h3>产品研判</h3></div><span>判断截至 {shortDate(assessment.as_of)} · {evidenceCount} 个核心证据段</span></div>
      <article className="assessment-verdict">
        <div className="assessment-verdict-copy"><span>当前判断 · {assessment.verdict.stance}</span><h4>{assessment.verdict.summary}</h4><p>结论优先呈现；具体判断均需回到下方模块与信源核验。</p></div>
        <dl>
          <div><dt>判断态度</dt><dd>{assessment.verdict.stance}</dd></div>
          <div><dt>产品潜力</dt><dd>{assessment.verdict.potential}</dd></div>
          <div><dt>当前完成度</dt><dd>{assessment.verdict.readiness}</dd></div>
          <div><dt>证据置信度</dt><dd>{assessment.verdict.confidence}</dd></div>
        </dl>
      </article>

      <div className="assessment-findings">
        <section className="assessment-panel strengths"><header><div><p>STRENGTHS</p><h4>产品亮点</h4></div><span>{assessment.strengths.length} 个报告识别亮点</span></header><div>{assessment.strengths.map((item, index) => (
          <article key={`${item.module}-${index}`}><div><b>{item.module}</b><span>{item.status || "已确认"}</span></div><h5>{item.title}</h5><p>{item.judgement}</p>{item.evidence_refs?.length ? <small>依据 · {item.evidence_refs.join(" / ")}</small> : null}</article>
        ))}</div></section>
        <section className="assessment-panel risks"><header><div><p>RISKS & UNKNOWNS</p><h4>不足与待判断</h4></div><span>{assessment.risks.length} 个报告识别问题</span></header><div>{assessment.risks.map((item, index) => (
          <article key={`${item.module}-${index}`}><div><b>{item.module}</b><span>{item.status || "待判断"}</span></div><h5>{item.title}</h5><p>{item.judgement}</p>{item.evidence_refs?.length ? <small>依据 · {item.evidence_refs.join(" / ")}</small> : null}</article>
        ))}</div></section>
      </div>

      <section className="assessment-changes"><header><div><p className="eyebrow">PRODUCT EVOLUTION</p><h4>项目演变与本轮变化</h4></div><span>按核心报告披露的版本信息整理</span></header><div>{assessment.changes_since_last_test.map((item, index) => (
        <article key={`${item.module}-${index}`}><span>{item.direction}</span><small>{item.module}</small><h5>{item.title}</h5><p>{item.detail}</p></article>
      ))}</div></section>

      <section className="assessment-watch"><header><div><p className="eyebrow">NEXT WATCH</p><h4>下一步观测</h4></div><span>将“持续关注”转化为下一轮信源需要回答的问题</span></header><ol>{assessment.next_watch.map((item, index) => (
        <li key={`${item.module}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.module}</b><p>{item.question}</p><small>观测触发点 · {item.trigger}</small></div></li>
      ))}</ol></section>

      {assessment.source && <a className="assessment-source" href={assessment.source.url || "#"} target="_blank" rel="noreferrer"><b>主要依据 · {assessment.source.label}</b><span>{assessment.source.title}{assessment.source.author ? ` · ${assessment.source.author}` : ""}{assessment.source.report_date ? ` · ${shortDate(assessment.source.report_date)}` : ""}</span>{assessment.source.scope && <small>{assessment.source.scope}</small>}<i>查看原报告 ↗</i></a>}
    </section>
  );
}

type PipelineEvidenceItem = {
  title: string;
  date?: string;
  source?: string;
  type?: string;
  kind?: string;
  summary?: string;
  url?: string;
  evidence_kind?: "video" | "report";
};

type PipelineEvidenceTone = "internal" | "playtest" | "media";

function pipelineEvidenceSections(item: Record<string, any>, assessment: StructuredAssessment | null) {
  const sections: Record<PipelineEvidenceTone, PipelineEvidenceItem[]> = { internal: [], playtest: [], media: [] };
  const seen = new Set<string>();
  const add = (tone: PipelineEvidenceTone, entry: PipelineEvidenceItem) => {
    const key = entry.url?.replace(/\/$/, "") || `${entry.date || ""}|${entry.title}`;
    if (!entry.title || seen.has(key)) return;
    seen.add(key);
    sections[tone].push(entry);
  };
  const classify = (entry: PipelineEvidenceItem, origin: "report" | "playtest" = "report"): PipelineEvidenceTone => {
    const text = `${entry.source || ""} ${entry.type || ""} ${entry.kind || ""} ${entry.title} ${entry.url || ""}`;
    if (/grp\.woa\.com|\bGRP\b|内部报告|内部研究|专项报告/i.test(text)) return "internal";
    if (origin === "playtest" || /试玩|实机|评测|体验|测试分析|深度体验|测试复盘/i.test(text)) return "playtest";
    return "media";
  };

  if (assessment?.source) {
    const source = assessment.source;
    const entry: PipelineEvidenceItem = {
      title: source.title || source.label,
      date: source.report_date || assessment.as_of,
      source: source.label,
      type: "核心报告",
      summary: source.scope,
      url: source.url,
    };
    add(classify(entry), entry);
  }

  (item.gameplay_videos || []).forEach((raw: Record<string, string>) => {
    const entry: PipelineEvidenceItem = {
      title: raw.title,
      date: raw.date || raw.milestone_date,
      source: raw.source || raw.platform || "公开实机",
      type: raw.type || raw.kind || "实机 / 试玩",
      summary: raw.summary,
      url: raw.url,
      evidence_kind: evidenceKind(raw),
    };
    add(classify(entry, entry.evidence_kind === "video" ? "playtest" : "report"), entry);
  });

  (item.media_reports || []).forEach((raw: Record<string, string>) => {
    const entry: PipelineEvidenceItem = {
      title: raw.title,
      date: raw.date,
      source: raw.source || "公开资料",
      type: raw.type,
      kind: raw.kind,
      summary: raw.summary,
      url: raw.url,
    };
    add(classify(entry), entry);
  });

  Object.values(sections).forEach((entries) => entries.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
  return sections;
}

function EvidenceColumn({ index, title, tone, items, empty }: { index: string; title: string; tone: PipelineEvidenceTone; items?: PipelineEvidenceItem[]; empty: string }) {
  return (
    <section className={`pipeline-evidence evidence-${tone}`}>
      <header className="pipeline-evidence-title"><span>{index}</span><b>{title}</b><em>{items?.length || 0}</em></header>
      <div className="pipeline-evidence-list">
        {items?.length ? items.slice(0, 5).map((item, index) => (
          <a className="pipeline-evidence-item" href={item.url || "#"} target="_blank" rel="noreferrer" key={`${item.title}-${index}`}>
            <div className="pipeline-source-line"><b>{item.type || item.kind || "资料"}</b><span>{item.source || "公开资料"}</span><span>·</span><span>{item.date || "持续更新"}</span></div>
            <strong>{item.title || "查看资料"}<i>↗</i></strong>
            {item.summary && <p>{item.summary}</p>}
          </a>
        )) : <p className="pipeline-empty">{empty}</p>}
      </div>
    </section>
  );
}

type RadarEventKind = "版本更新" | "重大新闻" | "新测试" | "上线节点";
type RadarEvent = {
  game: Game;
  kind: RadarEventKind;
  productType: "热门游戏" | "在研新品";
  date: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  target: "game" | "pipeline";
  status: "已确认" | "计划节点" | "待核验";
  publishedDate?: string;
  dateMeaning: "事件日期" | "消息日期";
};

function recordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function recordText(item: Record<string, unknown>, key: string) {
  return typeof item[key] === "string" || typeof item[key] === "number" ? String(item[key]) : "";
}

function mergeResearchRecords(curated: unknown, fetched: unknown, timeline: boolean) {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];
  const append = (record: Record<string, unknown>) => {
    const url = recordText(record, "url");
    const date = recordText(record, "date") || recordText(record, "published_date");
    const title = recordText(record, "title");
    const key = url || `${date}|${title}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(record);
  };
  recordList(curated).forEach(append);
  recordList(fetched).forEach((record) => append({
    ...record,
    date: recordText(record, "published_date"),
    type: recordText(record, "content_type") || "研究资料",
    kind: recordText(record, "content_type") || "研究资料",
    ...(timeline ? { timeline: false } : {}),
  }));
  return result.sort((left, right) => recordText(right, "date").localeCompare(recordText(left, "date")));
}

function readableHeadline(value: string) {
  return value.replace(/&#34;|&quot;/g, "“").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function evidenceKind(item: Record<string, unknown>): "video" | "report" {
  const explicit = recordText(item, "evidence_kind");
  if (explicit === "video" || explicit === "report") return explicit;
  const url = recordText(item, "url");
  return /bilibili\.com|youtu\.be|youtube\.com|game\.xiaomi\.com\/(?:gameVideo|viewpoint)/i.test(url) ? "video" : "report";
}

function isProductEventEvidence(item: Record<string, unknown>) {
  const title = recordText(item, "title");
  if (/分析|研判|测评|评测|研究|报告|访谈|走红|盘点|解读|攻略|GRP|拆解/i.test(title)) return false;
  return /开测|测试开启|测试结束|公测|上线|发售|推出|定档|版本|赛季|更新|联动|周年|补丁|停服|停运/.test(title);
}

function radarEventKind(item: Record<string, unknown>, fallback: RadarEventKind): RadarEventKind {
  const headline = `${recordText(item, "type")} ${recordText(item, "kind")} ${recordText(item, "title")}`;
  if (/正式上线|正式推出|正式公测|预计.*推出|计划.*公测|定档|发售/.test(headline)) return "上线节点";
  const text = `${recordText(item, "type")} ${recordText(item, "kind")} ${recordText(item, "title")} ${recordText(item, "version")} ${recordText(item, "summary")}`;
  if (/测试|首测|二测|三测|终测|删档|体验服|试玩|Demo|Beta/i.test(text)) return "新测试";
  if (/公测|正式版|正式上线|全球上线|定档|发售|版号|Early Access|EA\b/i.test(text)) return "上线节点";
  if (/版本|赛季|更新|联动|周年|补丁|平衡调整|(?:新增|全新|新)(?:玩法|地图|角色|系统|模式)|活动(?:开启|上线)|派对季|盛典季|寻鲸季/i.test(text)) return "版本更新";
  return fallback;
}

function makeRadarEvent(game: Game, item: Record<string, unknown>, fallback: RadarEventKind, target: RadarEvent["target"], productType: RadarEvent["productType"] = target === "pipeline" ? "在研新品" : "热门游戏", asOf = currentDateKey()): RadarEvent | null {
  const date = dateKey(recordText(item, "event_date") || recordText(item, "date"));
  const windowStart = shiftDate(asOf, -30);
  if (!date || date < windowStart || date > shiftDate(asOf, 30)) return null;
  const kind = radarEventKind(item, fallback);
  const explicitSummary = recordText(item, "summary") || recordText(item, "description");
  const summary = explicitSummary || (kind === "重大新闻" ? "公开信源出现值得持续跟进的产品信息。" : `该产品出现新的${kind}，进入近期重点观察。`);
  const rawTitle = recordText(item, "title") || recordText(item, "version") || recordText(item, "stage") || explicitSummary || `${game.name} · ${kind}节点更新`;
  return {
    game,
    kind,
    productType,
    date,
    dateMeaning: recordText(item, "event_date") || target === "pipeline" ? "事件日期" : "消息日期",
    title: readableHeadline(rawTitle),
    summary: readableHeadline(summary),
    source: recordText(item, "source") || "公开资料",
    url: recordText(item, "url") || undefined,
    target,
    publishedDate: dateKey(recordText(item, "published_date") || recordText(item, "observed_date")) || undefined,
    status: (recordText(item, "status") === "planned" || /计划|预计|即将/.test(rawTitle)) ? date < asOf ? "待核验" : "计划节点" : date > asOf ? "计划节点" : "已确认",
  };
}

function buildRadarEvents(games: Game[], pipelineDetails: DashboardData["pipelineDetails"], pipelineIcons: DashboardData["pipelineIcons"], allGames: Game[] = [], asOf = currentDateKey()) {
  const candidates: RadarEvent[] = [];
  const allGameMap = new Map(allGames.map((game) => [game.name, game]));
  games.forEach((game) => {
    recordList(game.intelligence?.recent_updates).forEach((item) => {
      const event = makeRadarEvent(game, item, "版本更新", "game", "热门游戏", asOf);
      if (event) candidates.push(event);
    });
    recordList(game.intelligence?.recent_articles).filter(isProductEventEvidence).forEach((item) => {
      const event = makeRadarEvent(game, item, "重大新闻", "game", "热门游戏", asOf);
      if (event) candidates.push(event);
    });
  });
  Object.entries(pipelineDetails || {}).forEach(([name, detail]) => {
    const knownGame = allGameMap.get(name);
    const game: Game = { ...knownGame, name, category: knownGame?.category || detail.category || pipelineCategoryFor(name) || "在研新品", icon_path: pipelineIcons[name]?.path || knownGame?.icon_path, developer: detail.developer || knownGame?.developer };
    const pipelineProductType: RadarEvent["productType"] = knownGame?.lifecycle?.pipeline === true
      ? "在研新品"
      : knownGame && isReleasedProduct(knownGame) ? "热门游戏" : "在研新品";
    recordList(detail.testing?.records).forEach((item) => {
      const event = makeRadarEvent(game, item, "新测试", "pipeline", pipelineProductType, asOf);
      if (event) candidates.push(event);
    });
    recordList(detail.media_reports).filter(isProductEventEvidence).forEach((item) => {
      const event = makeRadarEvent(game, item, "重大新闻", "pipeline", pipelineProductType, asOf);
      if (event) candidates.push(event);
    });
  });
  const latestByGameAndKind = new Map<string, RadarEvent>();
  candidates.forEach((event) => {
    const key = `${event.game.name}-${event.kind}`;
    const current = latestByGameAndKind.get(key);
    if (!current || event.date > current.date || (event.date === current.date && event.title.length > current.title.length)) latestByGameAndKind.set(key, event);
  });
  return [...latestByGameAndKind.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function latestRadarEventsByProduct(events: RadarEvent[], category: string) {
  const eventPriority: Record<RadarEventKind, number> = { "新测试": 4, "上线节点": 3, "版本更新": 2, "重大新闻": 1 };
  const latestByProduct = new Map<string, RadarEvent>();
  events.filter((event) => category === "全部" || event.game.category === category).forEach((event) => {
    const current = latestByProduct.get(event.game.name);
    if (!current || event.date > current.date || (event.date === current.date && eventPriority[event.kind] > eventPriority[current.kind])) latestByProduct.set(event.game.name, event);
  });
  return [...latestByProduct.values()].sort((a, b) => b.date.localeCompare(a.date) || eventPriority[b.kind] - eventPriority[a.kind] || a.game.name.localeCompare(b.game.name, "zh-CN"));
}

function buildStrategicPipelineEvents(strategicPipelineNames: Set<string>, pipelineDetails: DashboardData["pipelineDetails"], pipelineIcons: DashboardData["pipelineIcons"], allGames: Game[], asOf = currentDateKey()) {
  const allGameMap = new Map(allGames.map((game) => [game.name, game]));
  return [...strategicPipelineNames].map((name): RadarEvent | null => {
    const detail = pipelineDetails[name];
    if (!detail) return null;
    const knownGame = allGameMap.get(name);
    if (knownGame && isReleasedProduct(knownGame)) return null;
    const game: Game = { ...knownGame, name, category: knownGame?.category || detail.category || pipelineCategoryFor(name) || "在研新品", icon_path: pipelineIcons[name]?.path || knownGame?.icon_path };
    return recordList(detail.testing?.records)
      .map(item => makeRadarEvent(game, item, "新测试", "pipeline", "在研新品", asOf))
      .filter((event): event is RadarEvent => Boolean(event))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }).filter((event): event is RadarEvent => Boolean(event));
}

type CategoryInsight = {
  name: string;
  group: string;
  description: string;
  count: number;
  strategicPipelineNames: string[];
  pipelineUpdates: RadarEvent[];
  popularGameUpdates: RadarEvent[];
  recentEvents: RadarEvent[];
  representativeProducts: Game[];
};

const CATEGORY_OVERVIEW_ORDER = ["派对闯关", "模拟经营类", "捉宠类", "社交-多人合作类"];

function CategoryUpdateSummary({ events }: { events: RadarEvent[] }) {
  return <>{events.map((event, index) => <span className="category-update-item" key={`${event.game.name}-${event.kind}`}>{index > 0 && "；"}<strong>{event.game.name}</strong>：{event.title}</span>)}</>;
}

function categoryEventStrategicScore(event: RadarEvent, strategicPipelineNames: Set<string>) {
  const strategicPipeline = event.productType === "在研新品" && strategicPipelineNames.has(event.game.name);
  const productWeight = strategicPipeline ? 100 : event.productType === "在研新品" ? 50 : 0;
  const kindWeight: Record<RadarEventKind, number> = { "新测试": 20, "上线节点": 12, "版本更新": 4, "重大新闻": 1 };
  return productWeight + kindWeight[event.kind];
}

function buildCategoryInsights(games: Game[], events: RadarEvent[], strategicPipelineEvents: RadarEvent[], categoryMeta: DashboardData["categoryMeta"], strategicPipelineNames: Set<string>, allGames: Game[] = games): CategoryInsight[] {
  const categoryNames = [...new Set([...Object.keys(categoryMeta || {}), ...games.map((game) => game.category || "其他类")])];
  return categoryNames.map((name) => {
    const categoryGames = games.filter((game) => (game.category || "其他类") === name);
    const categoryEvents = events.filter((event) => event.game.category === name);
    const categoryStrategicEvents = strategicPipelineEvents.filter((event) => event.game.category === name);
    const categoryEventPriority: Record<RadarEventKind, number> = { "新测试": 4, "上线节点": 3, "版本更新": 2, "重大新闻": 1 };
    const recentEventByGame = new Map<string, RadarEvent>();
    categoryEvents.filter((event) => event.kind === "版本更新" || event.kind === "新测试" || event.kind === "上线节点").forEach((event) => {
      const current = recentEventByGame.get(event.game.name);
      if (!current || event.date > current.date || (event.date === current.date && categoryEventPriority[event.kind] > categoryEventPriority[current.kind])) recentEventByGame.set(event.game.name, event);
    });
    categoryStrategicEvents.forEach((event) => {
      if (!recentEventByGame.has(event.game.name)) recentEventByGame.set(event.game.name, event);
    });
    const rankEvents = (a: RadarEvent, b: RadarEvent) => categoryEventStrategicScore(b, strategicPipelineNames) - categoryEventStrategicScore(a, strategicPipelineNames) || b.date.localeCompare(a.date) || categoryEventPriority[b.kind] - categoryEventPriority[a.kind];
    const distinctUpdates = (candidateEvents: RadarEvent[]) => {
      const seenGames = new Set<string>();
      return [...candidateEvents].sort(rankEvents).filter((event) => {
        if (seenGames.has(event.game.name)) return false;
        seenGames.add(event.game.name);
        return true;
      }).slice(0, 2);
    };
    const recentEvents = [...recentEventByGame.values()].sort(rankEvents).slice(0, 3);
    const strategicNames = allGames.filter(game => game.category === name && strategicPipelineNames.has(game.name) && !isReleasedProduct(game)).map(game => game.name);
    const pipelineUpdates = distinctUpdates([...categoryStrategicEvents, ...categoryEvents.filter((event) => event.productType === "在研新品")]);
    const popularGameUpdates = distinctUpdates(categoryEvents.filter((event) => event.productType === "热门游戏" && (event.kind === "版本更新" || event.kind === "重大新闻")));
    const representativeUpdates = new Map(popularGameUpdates.map((event) => [event.game.name, event]));
    const representativeCandidates = [...categoryGames].sort((a, b) => {
      const updateDifference = Number(representativeUpdates.has(b.name)) - Number(representativeUpdates.has(a.name));
      const dauDifference = (mobileDau(b) ?? -1) - (mobileDau(a) ?? -1);
      const revenueDifference = (numericMetric(b.metrics?.monthly_revenue) ?? -1) - (numericMetric(a.metrics?.monthly_revenue) ?? -1);
      return updateDifference || dauDifference || revenueDifference || a.name.localeCompare(b.name, "zh-CN");
    });
    const representativeProducts = representativeCandidates.slice(0, 3);
    return {
      name,
      group: categoryMeta[name]?.group || "其他",
      description: categoryMeta[name]?.desc || "持续观察该品类的供给变化、头部表现与新品验证节奏。",
      count: categoryGames.length,
      strategicPipelineNames: strategicNames,
      pipelineUpdates,
      popularGameUpdates,
      recentEvents,
      representativeProducts,
    };
  }).filter((insight) => insight.count > 0 && insight.name !== "其他类").sort((a, b) => {
    const aIndex = CATEGORY_OVERVIEW_ORDER.indexOf(a.name);
    const bIndex = CATEGORY_OVERVIEW_ORDER.indexOf(b.name);
    const aRank = aIndex === -1 ? CATEGORY_OVERVIEW_ORDER.length : aIndex;
    const bRank = bIndex === -1 ? CATEGORY_OVERVIEW_ORDER.length : bIndex;
    return aRank - bRank || b.count - a.count;
  });
}

function RadarDigest({ events, pipelineProducts, category, asOf, onOpenEvent, onOpenPipeline }: {
  events: RadarEvent[];
  pipelineProducts: Game[];
  category: string;
  asOf: string;
  onOpenEvent: (event: RadarEvent) => void;
  onOpenPipeline: (name: string) => void;
}) {
  const recentStart = shiftDate(asOf, -29);
  const liveItems = events.filter((event) => event.productType === "热门游戏").slice(0, 4).map((event) => ({ game: event.game, event, recent: false }));
  const pipelineItems = pipelineProducts
    .filter((game) => category === "全部" || game.category === category)
    .map((game) => {
      const event = events.find((candidate) => candidate.productType === "在研新品" && candidate.game.name === game.name);
      const changeDate = event?.publishedDate || event?.date || "";
      const recent = Boolean(event && changeDate >= recentStart && changeDate <= asOf && (event.status !== "计划节点" || Boolean(event.publishedDate)));
      return { game, event, recent };
    })
    .sort((a, b) => Number(b.recent) - Number(a.recent) || (b.event?.date || "").localeCompare(a.event?.date || "") || a.game.name.localeCompare(b.game.name, "zh-CN"));
  const columns = [
    { id: "live", title: "已上线产品", items: liveItems },
    { id: "pipeline", title: "在研新品", items: pipelineItems },
  ] as const;

  return (
    <section className="radar-digest">
      <header><div><p className="eyebrow">CATEGORY SIGNALS</p><h2>游戏版本动态</h2></div></header>
      <div className="radar-digest-columns">
        {columns.map((column) => <section className={`radar-digest-column ${column.id}`} aria-label={column.title} key={column.id}>
          <header><div><strong>{column.title}</strong><small>{column.id === "live" ? "近30日版本/玩法更新情况" : "测试与研发节点"}</small></div><b>{column.items.length}</b></header>
          <div className="radar-digest-list">{column.items.length ? column.items.map((item) => (
            <button className={item.recent ? "radar-digest-item-recent" : ""} onClick={() => item.event ? onOpenEvent(item.event) : onOpenPipeline(item.game.name)} key={item.game.name}>
              <span className="digest-icon-wrap"><GameIcon game={item.game} className="digest-game-icon" />{item.recent && <i className="digest-recent-badge" aria-hidden="true">新</i>}</span>
              <span><strong>{item.game.name}</strong><small>{item.event?.title || "当前暂无近30日变化，持续跟踪研发节点"}</small></span>
              <em>{item.recent && <b className="radar-digest-new">近30日</b>}<b>{item.event?.kind || "在研项目"}</b><small>{item.event ? shortDate(item.event.date) : "持续跟踪"}</small></em>
            </button>
          )) : <p className="radar-digest-empty">该品类暂无近期动态</p>}</div>
        </section>)}
      </div>
    </section>
  );
}

function pipelineMatrixStageFromText(text: string, item: Record<string, unknown>): PipelineMatrixStage | null {
  const lifecycle = lifecyclePhase(item);
  if (lifecycle === "license") return null;
  const normalizedText = text.replace(/不计费/g, "免费").replace(/测试(?:与上线)?未定|开测日待核验/g, "");
  if (/三测|第三次|终测|不删档|删档计费|计费测试|上线前|公测前|软启动|先行版|上线验证/i.test(normalizedText)) return "third";
  if (/二测|第二次|定格测试|星旅二测|进化测试/i.test(normalizedText)) return "second";
  if (/一测|首次.{0,8}测试|首测|冒泡测试|大狩猎测试|藏锋测试|宜居测试|结缘测试|国服首测|公开测试|Playtest|Open Beta|测试/i.test(normalizedText)) return "first";
  if (/首曝|首次公开|首亮相|首支\s*PV|发布会|正式定名|产品公布|官宣新作/i.test(normalizedText)) return "project";
  if (lifecycle === "project") return "project";
  if (lifecycle === "internal" || lifecycle === "first") return "first";
  if (lifecycle === "retest") return "second";
  if (lifecycle === "prelaunch") return "third";
  return null;
}

function pipelineMatrixEntry(name: string, item: Record<string, unknown>, game: Game, asOf = currentDateKey()): PipelineMatrixEntry {
  const stageRank: Record<PipelineMatrixStage, number> = { project: 0, first: 1, second: 2, third: 3, launch: 4 };
  const stageDate = recordText(item, "stage_date");
  const currentStageText = recordText(item, "stage") || recordText(item, "release_status");
  const currentStage = currentStageText ? [{ date: stageDate, type: "当前阶段", title: currentStageText }] : [];
  const candidates = [...pipelineMilestones(name, item), ...currentStage]
    .map((milestone) => {
      // Only classify the milestone itself. Summaries often mention a future
      // round to watch and must not move the product into that later column.
      const text = `${recordText(milestone, "type")} ${recordText(milestone, "kind")} ${recordText(milestone, "title")}`;
      const stage = pipelineMatrixStageFromText(text, milestone);
      return stage ? { milestone, stage, text } : null;
    })
    .filter((candidate): candidate is { milestone: Record<string, unknown>; stage: PipelineMatrixStage; text: string } => Boolean(candidate))
    .sort((a, b) => stageRank[b.stage] - stageRank[a.stage] || (dateKey(recordText(b.milestone, "date")) || "").localeCompare(dateKey(recordText(a.milestone, "date")) || ""));
  const selected = candidates[0];
  const stage = selected?.stage || "project";
  const text = selected?.text || "";
  const normalizedText = text.replace(/不计费/g, "免费");
  const testName = testMilestoneName(selected?.milestone || {});
  const stageLabel = stage === "project" ? "已首曝"
    : /测试版本/.test(normalizedText) ? "测试版本"
    : /软启动/i.test(normalizedText) ? "软启动"
    : /先行版/i.test(normalizedText) ? "先行版"
    : /不删档/i.test(normalizedText) ? "不删档测试"
    : /删档计费|计费测试/i.test(normalizedText) ? "计费测试"
    : /终测/i.test(normalizedText) ? "终测"
    : /三测|第三次/i.test(normalizedText) ? "三测"
    : /二测|第二次/i.test(normalizedText) ? "二测"
    : testName && testName !== "测试" ? testName
    : PIPELINE_MATRIX_STAGES.find((entry) => entry.id === stage)?.label || "当前节点";
  const rawDate = selected ? recordText(selected.milestone, "date") : "";
  const recentUpdateStart = shiftDate(asOf, -6);
  const recentUpdateDate = [
    recordText(item, "stage_date"),
    ...recordList(item.testing && typeof item.testing === "object" ? (item.testing as Record<string, unknown>).records : undefined).flatMap((record) => [recordText(record, "date"), recordText(record, "observed_date")]),
    ...recordList(item.media_reports).flatMap((record) => [recordText(record, "date"), recordText(record, "observed_date")]),
    ...recordList(item.gameplay_videos).flatMap((record) => [recordText(record, "date") || recordText(record, "milestone_date"), recordText(record, "observed_date")]),
  ]
    .map(dateKey)
    .filter((date) => date >= recentUpdateStart && date <= asOf)
    .sort()
    .at(-1);
  return {
    name,
    stage,
    stageLabel,
    date: rawDate ? shortDate(rawDate) : stage === "project" ? "持续跟踪" : "日期待核验",
    planned: Boolean(selected && timelineStatus(selected.milestone, asOf) === "planned"),
    recentUpdateDate,
    game,
  };
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const finalDay = Math.min(day, new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate());
  target.setUTCDate(finalDay);
  return target.toISOString().slice(0, 10);
}

function isActualLaunchRecord(item: Record<string, unknown>) {
  const type = recordText(item, "type");
  const kind = recordText(item, "kind");
  const sourceLabel = `${type} ${kind}`;
  const directLaunch = /正式上线|正式公测|官方上线|公测开启|全球上线|软启动|先行版(?:正式)?上线/i.test(sourceLabel);
  return directLaunch && !/定档|公告|准备|口碑|复盘/i.test(sourceLabel);
}

function recentLaunchLabel(item: Record<string, unknown>) {
  const text = `${recordText(item, "type")} ${recordText(item, "kind")} ${recordText(item, "title")}`;
  if (/软启动/i.test(text)) return "软启动";
  if (/先行版/i.test(text)) return "先行版上线";
  if (/公测/i.test(text)) return "正式公测";
  return "正式上线";
}

function buildRecentLaunchEntries(pipelineDetails: DashboardData["pipelineDetails"], pipelineIcons: DashboardData["pipelineIcons"], games: Game[], asOf = currentDateKey()) {
  const windowStart = shiftMonth(asOf, -1);
  const windowEnd = shiftMonth(asOf, 1);
  const gameMap = new Map(games.map((game) => [game.name, game]));
  const entries = new Map<string, RecentLaunchEntry>();
  const pipelineLaunchNames = new Set<string>();

  Object.entries(pipelineDetails || {}).forEach(([name, detail]) => {
    const game = gameMap.get(name) || { name, category: detail.category, developer: detail.developer, icon_path: pipelineIcons[name]?.path };
    const records = [...recordList(detail.testing?.records), ...recordList(detail.media_reports)];
    records.filter(isActualLaunchRecord).forEach((item) => {
      const date = dateKey(recordText(item, "date"));
      if (!date || date < windowStart || date > windowEnd) return;
      pipelineLaunchNames.add(name);
      entries.set(`${name}|${date}`, {
        name,
        date,
        label: recentLaunchLabel(item),
        title: readableHeadline(recordText(item, "title") || `${name}上线`),
        planned: recordText(item, "status") === "planned" || date > asOf,
        target: "pipeline",
        game,
      });
    });
  });

  games.forEach((game) => {
    const releaseDate = String(game.release_date || "").trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : "";
    if (!date || date < windowStart || date > windowEnd || pipelineLaunchNames.has(game.name)) return;
    entries.set(`${game.name}|${date}`, {
      name: game.name,
      date,
      label: "正式上线",
      title: `${game.name}正式上线`,
      planned: date > asOf,
      target: pipelineDetails[game.name] ? "pipeline" : "game",
      game,
    });
  });

  return [...entries.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "zh-CN"));
}

function PipelineStageMatrix({ rows, recentLaunches, asOf, onOpenPipeline, onOpenGame }: {
  rows: PipelineMatrixRow[];
  recentLaunches: RecentLaunchEntry[];
  asOf: string;
  onOpenPipeline: (name: string) => void;
  onOpenGame: (game: Game) => void;
}) {
  const windowStart = shiftMonth(asOf, -1);
  const windowEnd = shiftMonth(asOf, 1);
  const inWindow = (date: string) => {
    const key = date.replaceAll(".", "-");
    return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= windowStart && key <= windowEnd;
  };
  const launchesByName = new Map<string, RecentLaunchEntry>();
  for (const entry of recentLaunches.filter(entry => inWindow(entry.date))) {
    const existing = launchesByName.get(entry.name);
    if (!existing || entry.date > existing.date || (entry.date === existing.date && !entry.planned)) launchesByName.set(entry.name, entry);
  }
  const mergedRows: PipelineMatrixRow[] = rows.map(row => ({ ...row, entries: row.entries.filter(entry => !launchesByName.has(entry.name)) }));
  for (const entry of launchesByName.values()) {
    const category = String(entry.game.category || pipelineCategoryFor(entry.name) || "其他类").replace("社交-", "");
    let row = mergedRows.find(row => row.label === category);
    if (!row) { row = { id: `launch-${category}`, label: category, color: "#64748b", entries: [] }; mergedRows.push(row); }
    row.entries.push({ name: entry.name, stage: "launch", stageLabel: entry.planned ? "上线定档" : entry.label, date: shortDate(entry.date), planned: entry.planned, target: entry.target, game: entry.game });
  }
  const visibleRows = mergedRows.filter(row => row.entries.length);
  const projectCount = new Set(visibleRows.flatMap(row => row.entries.map(entry => entry.name))).size;
  return (
    <section className="pipeline-stage-matrix" aria-label="近期在研动态">
      <div className="section-intro pipeline-stage-matrix-intro">
        <div><p className="eyebrow">PIPELINE LANDSCAPE</p><h2>近期在研动态</h2></div>
        <p>首曝与测试保留原有节点；上线展示今天前后各一个月 · {shortDate(windowStart)} — {shortDate(windowEnd)}</p>
      </div>
      <div className="pipeline-stage-chart">
        <header className="pipeline-stage-chart-toolbar">
          <span><b>{projectCount}</b> 款近期产品</span>
          <div><span><i className="confirmed" />已发生节点</span><span><i className="planned" />已公布待验证</span><span><i className="recent" />近 7 天更新</span></div>
        </header>
        <div className="pipeline-stage-chart-scroll">
          <div className="pipeline-stage-chart-canvas">
            {visibleRows.map((row) => <div className="pipeline-stage-chart-row" style={{ "--matrix-accent": row.color } as CSSProperties} key={row.id}>
              <header><i /><strong>{row.label}</strong><small>{new Set(row.entries.map(entry => entry.name)).size} 款</small></header>
              {PIPELINE_MATRIX_STAGES.map((stage) => {
                const entries = row.entries.filter((entry) => entry.stage === stage.id);
                return <div className="pipeline-stage-chart-zone" data-stage={stage.id} key={stage.id}>
                  {entries.map((entry) => <button className={`pipeline-stage-chart-node ${entry.planned ? "planned" : "confirmed"} ${entry.recentUpdateDate ? "recently-updated" : ""}`} onClick={() => entry.target === "game" ? onOpenGame(entry.game) : onOpenPipeline(entry.name)} aria-label={`查看${entry.name}产品详情${entry.recentUpdateDate ? "，近7天有更新" : ""}`} title={`${entry.name} · ${entry.stageLabel} · ${entry.date}${entry.recentUpdateDate ? ` · ${shortDate(entry.recentUpdateDate)} 更新` : ""}`} key={`${entry.name}-${entry.stage}-${entry.date}`}>
                    <span className="pipeline-stage-chart-icon-wrap"><GameIcon game={entry.game} className="pipeline-stage-chart-icon" />{entry.recentUpdateDate && <i className="pipeline-stage-chart-recent-badge" aria-hidden="true">新</i>}</span>
                    <span className="pipeline-stage-chart-copy"><span className="pipeline-stage-chart-title"><strong>{entry.name}</strong>{entry.recentUpdateDate && <em>7日更新</em>}</span><small>{entry.stageLabel} · {entry.date}</small></span>
                  </button>)}
                </div>;
              })}
            </div>)}
            <div className="pipeline-stage-chart-axis">
              <div className="pipeline-stage-chart-spacer" aria-hidden="true" />
              {PIPELINE_MATRIX_STAGES.map((stage) => <div className="pipeline-stage-chart-tick" key={stage.id}><small>{stage.index}</small><strong>{stage.label}</strong></div>)}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function RevenueAnomalies({ games, asOf, onOpenGame }: { games: Game[]; asOf: string; onOpenGame: (game: Game) => void }) {
  const results = useMemo(() => games.map(game => {
    const checks = (["activity", "revenue"] as const).map(kind => ({ kind, ...evaluateMetricSeries(game.metrics_trend_30d, kind, asOf, productPlatformText(game), game.release_date) }));
    return { game, checks, signals: checks.flatMap(check => check.signal?.triggered ? [check.signal] : []) };
  }), [games, asOf]);
  const alerts = results.filter(result => result.signals.length).sort((a, b) => Math.max(...b.signals.map(s => Math.abs(s.change))) - Math.max(...a.signals.map(s => Math.abs(s.change))));
  const covered = results.filter(result => result.checks.some(check => check.signal)).length;
  const complete = results.filter(result => result.checks.every(check => check.signal)).length;
  const dates = results.flatMap(result => result.checks.flatMap(check => check.signal ? [check.signal.end] : [])).sort();
  const changeLabel = (signal?: MetricSignal) => signal ? `${signal.change > 0 ? "+" : ""}${(signal.change * 100).toFixed(1)}%` : "—";
  const explanation = (game: Game, checks: typeof results[number]["checks"]) => {
    const signals = checks.flatMap(c => c.signal?.triggered ? [c.signal] : []);
    const attribution = anomalyAttribution(game.name, signals);
    if (attribution) return attribution.summary;
    const pattern = signals.map(s => `${s.metric === "日收入" ? "收入" : s.metric}显著${s.change > 0 ? "增长" : "下降"}`).join("、");
    const related = recordList(game.intelligence?.recent_updates).filter(item => {
      const date = recordText(item, "date");
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^https?:\/\//.test(recordText(item, "url")) && signals.some(s => date >= s.start && date <= s.end);
    }).sort((a, b) => recordText(b, "date").localeCompare(recordText(a, "date")))[0];
    const clue = related && (recordText(related, "version") || recordText(related, "title"));
    return `${pattern}；${clue ? `同期更新：${readableHeadline(clue)}（关联待核验）` : "本期归因数据暂不可用"}`;
  };
  return <section className="revenue-anomalies" aria-label="热门游戏数据异动">
    <div className="section-intro"><div><p className="eyebrow">PRODUCT SIGNALS</p><h2>热门游戏数据异动</h2></div><p>{dates.length ? `数据截至 ${dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} — ${dates.at(-1)}`}` : "等待有效日频数据"}</p></div>
    <div className="anomaly-panel">
      <div className="anomaly-rankings">{([{ direction: 1, title: "明显上涨" }, { direction: -1, title: "明显下降" }] as const).map(({ direction, title }) => {
        const strength = (signals: MetricSignal[]) => Math.max(...signals.filter(s => s.change * direction > 0).map(s => Math.abs(s.change)));
        const ranked = alerts.filter(r => r.signals.some(s => s.change * direction > 0)).sort((a, b) => strength(b.signals) - strength(a.signals));
        return <section className="anomaly-ranking" aria-label={title} key={direction}>
          <header><strong>{title}</strong><span>{ranked.length}</span></header>
          <div className="anomaly-rank-head"><span>产品</span><span>DAU / ACU</span><span>收入</span></div>
          <div className="anomaly-rank-list" tabIndex={0} aria-label={`${title}产品列表`}>{ranked.length ? ranked.map(({ game, checks }) => <button className="anomaly-rank-row" onClick={() => onOpenGame(game)} aria-label={`查看${game.name}异动及近期版本`} title={game.name} key={game.name}>
            <GameIcon game={game} className="category-node-icon" />
            {checks.map(check => <span key={check.kind} className={check.signal?.triggered ? check.signal.change > 0 ? "anomaly-up" : "anomaly-down" : "anomaly-neutral"} title={check.signal ? `${check.signal.scope} · ${check.signal.start}—${check.signal.end} 对比 ${check.signal.baselineStart}—${check.signal.baselineEnd} · ${check.signal.source}${check.signal.triggered ? " · 达到异动阈值" : " · 未达到异动阈值"}` : check.reason}>{changeLabel(check.signal)}{check.kind === "activity" && check.signal && <small> {check.signal.metric}</small>}</span>)}
            <small className="anomaly-rank-note">{explanation(game, checks)}{checks.some(c => !c.signal) && <span>{checks.filter(c => !c.signal).map(c => `${c.kind === "activity" ? "DAU/ACU" : "收入"}：${c.reason}（— 不代表零）`).join("；")}</span>}</small>
          </button>) : <p className="anomaly-rank-empty">{covered ? `可判定指标暂无${title}` : "数据不足，暂不能判断"}</p>}</div>
        </section>;
      })}</div>
      <details className="anomaly-rules"><summary>归因信源与筛选规则</summary><p>最近核查：{ATTRIBUTION_REVIEW_DATE}。逐款区分可能原因、证据不足与尚未核查；已核实事件不等于已证实因果。归因按观察区间匹配，区间更新后需重新核验。</p><ul>{alerts.map(r => { const a = anomalyAttribution(r.game.name, r.signals); return a ? <li key={r.game.name}><b>{r.game.name}</b>（核查 {a.reviewedAt}）：{a.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗ </a>)}</li> : null; })}</ul><p>观察日 {asOf} · 检查 {games.length} 款，{covered} 款至少一个指标可判定，{alerts.length} 款触发。按各栏显著涨跌幅从大到小排列；两项指标出现反向异动时，两栏均展示。彩色数值达到阈值，灰色为未触发的实际变化，“—”为无法判定；悬停查看产品名、统计区间与口径，点击进入详情。</p><p>以每项指标最新有效日为终点，最近 7 天日均值对比此前 28 天日均值。涨跌幅至少 25%，且差值达到前 4 个完整周均值的 3 倍样本标准差；同时至少 3 天相较此前 4 周同星期日均值，同向涨跌达到 25%。完整周对比降低周末波动影响，多日条件过滤单日尖峰。这是关注阈值，不是异常原因或统计显著性的证明。</p><p>同一序列内比较来源、平台、地区和币种一致的数据。活跃指标采用日频 DAU；PC 端仅有 ACU 时保留 ACU 口径，逐产品与自身历史比较，不换算为 DAU。收入只采用日收入，月收入、累计收入不替代。缺少连续 35 天数据、最新数据超过 7 天、重复记录或零基数时暂不判定；上市初期历史不足也不作正常波动结论。收入为来源估算，不等于厂商公布流水。</p><p>当前 {games.length - complete} 款至少缺少一项可判定指标。未触发只代表已覆盖指标未达到阈值，不代表全量产品没有异动。</p>{results.some(r => r.checks.some(c => c.reason)) && <ul>{results.filter(r => r.checks.some(c => c.reason)).map(r => <li key={r.game.name}><b>{r.game.name}</b>：{r.checks.filter(c => c.reason).map(c => `${c.kind === "activity" ? "DAU/ACU" : "收入"} — ${c.reason}`).join("；")}</li>)}</ul>}</details>
    </div>
  </section>;
}

function YouyansuoSection({ discovery }: { discovery: YouyansuoDiscovery | null }) {
  if (!discovery) return null;
  const columns = [
    { title: "新品候选", rows: discovery.candidates, count: discovery.meta.candidates, kind: "candidate" },
    { title: "已跟踪动态", rows: discovery.tracked_updates, count: discovery.meta.tracked_updates, kind: "tracked" },
  ];
  return <section className="youyansuo-section" aria-label="游研所产品情报">
    <header><div><p className="eyebrow">YOUYANSUO INTELLIGENCE</p><h2>新品发现与开发动态</h2></div><span>扫描 {discovery.meta.scan_date} · 来源日期不等于开测或上线日期</span></header>
    <div className="youyansuo-columns">{columns.map(({ title, rows, count, kind }) => <div className="youyansuo-column" key={kind}>
      <div className="youyansuo-column-head"><strong>{title}</strong><b>{count}</b></div>
      <div className="youyansuo-list">{rows.length ? rows.map((item) => <article className="youyansuo-row" key={`${item.name}-${item.source_url}`}>
        <div className="youyansuo-row-top"><strong>{item.name}</strong><span>{item.disposition}</span></div>
        <div className="youyansuo-row-meta"><time dateTime={item.published_date}>来源 {item.published_date}</time><span>{item.category.join(" / ") || (kind === "candidate" ? "品类待核验" : "已跟踪产品")}</span>{kind === "candidate" && <span>{item.identity_status.startsWith("confirmed") ? "身份已核验" : "身份待核验"}</span>}</div>
        <p>{item.summary}</p>
        <a href={item.source_url} target="_blank" rel="noreferrer" aria-label={`查看${item.name}的来源：${item.evidence_title}`}>{item.evidence_title || "查看来源"} <span aria-hidden="true">↗</span></a>
      </article>) : <p className="youyansuo-empty">本期暂无可核验报道</p>}</div>
    </div>)}</div>
  </section>;
}

function CategoryOverview({ discovery, signalEvents, pipelineProducts, insights, allGames, releasedGames, matrixRows, recentLaunches, asOf, onOpenCategory, onOpenGame, onOpenEvent, onOpenPipeline }: {
  discovery: YouyansuoDiscovery | null;
  signalEvents: RadarEvent[];
  pipelineProducts: Game[];
  insights: CategoryInsight[];
  allGames: Game[];
  releasedGames: Game[];
  matrixRows: PipelineMatrixRow[];
  recentLaunches: RecentLaunchEntry[];
  asOf: string;
  onOpenCategory: (category: string) => void;
  onOpenGame: (game: Game) => void;
  onOpenEvent: (event: RadarEvent) => void;
  onOpenPipeline: (name: string) => void;
}) {
  const focusInsights = [...insights].sort((a, b) => b.recentEvents.length - a.recentEvents.length);

  return (
    <section className="workspace category-overview">
      <div className="category-period-note"><strong>重点在研 / 近期节点</strong><span>{`完整展示 ${focusInsights.length} 个品类，无近期动态的品类也保留`}</span><b>点击品类名进入产品榜，点击代表产品查看详情</b></div>
      <div className="section-intro category-intro"><div><p className="eyebrow">CATEGORY OBSERVATORY</p><h2>重点品类</h2></div><p>按近期重点动态数量排序；点击代表产品查看详情。</p></div>
      <YouyansuoSection discovery={discovery} />
      <div className="category-card-grid" aria-label="观测品类卡片">
        {focusInsights.map((insight, index) => {
          const additions = categoryIntakes(allGames, insight.name, gameIntakes, asOf);
          const visibleEvents = insight.recentEvents;
          return (
          <article className={`category-card ${index === 0 ? "featured" : ""}${additions.length ? " has-new-intake" : ""}`} key={insight.name}>
            <header><div className="category-heading"><div className="category-heading-meta"><p>{insight.group}</p>{additions.length > 0 && <span className="category-intake-count" title="按收录日期保留7天，不代表游戏刚上线">新增 {additions.length} 款</span>}</div><h3><button className="category-title-link" onClick={() => onOpenCategory(insight.name)}>{insight.name.replace("社交-", "")}<span aria-hidden="true">→</span></button></h3></div><span>{insight.count} 款已上线{insight.strategicPipelineNames.length ? ` · ${insight.strategicPipelineNames.length} 款在研` : ""}</span></header>
            {insight.representativeProducts.length > 0 && <div className="category-representative">
              <div className="category-representative-head"><small>代表性产品</small><em>点击查看游戏详情</em></div>
              <div className="category-representative-list">{insight.representativeProducts.map((game) => <button type="button" className="category-representative-item" onClick={() => onOpenGame(game)} aria-label={`查看${game.name}详情`} key={game.name}>
                <GameIcon game={game} className="category-representative-icon" />
                <span><strong>{game.name}</strong><small>{game.developer || game.publisher || "重点样本"}</small></span>
              </button>)}</div>
            </div>}
            <p className="category-thesis">{insight.description}</p>
            <div className="category-findings" aria-label={`${insight.name}本期结论`}>
              <p><b>在研产品</b><span>{insight.pipelineUpdates.length ? <CategoryUpdateSummary events={insight.pipelineUpdates} /> : "近 30 日暂无明确在研更新。"}</span></p>
              <p><b>热门游戏</b><span>{insight.popularGameUpdates.length ? <CategoryUpdateSummary events={insight.popularGameUpdates} /> : "近 30 日暂无热门游戏重大更新。"}</span></p>
            </div>
            <div className="category-nodes">
              {additions.length > 0 && <div className="category-nodes-head"><b>看板新收录</b><span>资料收录日期</span></div>}
              {additions.map(game => (
                <button className="category-intake-row" onClick={() => game.lifecycle?.pipeline ? onOpenPipeline(game.name) : onOpenGame(game)} key={`intake-${game.name}`}>
                  <span className="category-intake-icon"><GameIcon game={game} className="category-node-icon" /><b>新收录</b></span>
                  <span><strong>{game.name}</strong><small>{gameIntakes[game.name].summary}</small></span>
                  <em><b className={game.lifecycle?.pipeline ? "pipeline" : "live"}>{game.lifecycle?.pipeline ? "在研新品" : game.pool === "边界观察池" ? "边界观察" : "热门游戏"}</b><small>收录于 {shortDate(gameIntakes[game.name].added_on)}</small></em>
                </button>
              ))}
              <div className="category-nodes-head"><b>近期重点动态</b><span>热门游戏 / 在研新品</span></div>
              {visibleEvents.length ? visibleEvents.map((event) => (
                <button onClick={() => onOpenEvent(event)} key={`${insight.name}-${event.game.name}-${event.kind}`}>
                  <GameIcon game={event.game} className="category-node-icon" />
                  <span><strong>{event.game.name}</strong><small>{event.title}</small></span>
                  <em><b className={event.productType === "在研新品" ? "pipeline" : "live"}>{event.productType}</b><small><span>{event.kind}</span><span>{event.dateMeaning === "消息日期" ? "消息" : event.status === "已确认" ? "发生" : event.status === "待核验" ? "待核验" : "计划"} · {shortDate(event.date)}</span></small></em>
                </button>
              )) : <p className="category-empty">近期暂无更新</p>}
            </div>
          </article>
        );})}
      </div>

      <section className="product-signal-sections" aria-label="热门游戏动态">
        <RevenueAnomalies games={releasedGames} asOf={asOf} onOpenGame={onOpenGame} />
        <RadarDigest events={signalEvents} pipelineProducts={pipelineProducts} category="全部" asOf={asOf} onOpenEvent={onOpenEvent} onOpenPipeline={onOpenPipeline} />
      </section>
      <PipelineStageMatrix rows={matrixRows} recentLaunches={recentLaunches} asOf={asOf} onOpenPipeline={onOpenPipeline} onOpenGame={onOpenGame} />
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [discovery, setDiscovery] = useState<YouyansuoDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("games");
  const [overviewView, setOverviewView] = useState<OverviewView>("categories");
  const [category, setCategory] = useState("全部");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Game | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedStudioName, setSelectedStudioName] = useState<string | null>(null);
  const [studioScope, setStudioScope] = useState<"总览" | "国内" | "海外">("总览");
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("mobile_dau");
  const [productPage, setProductPage] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rankingCategoriesExpanded, setRankingCategoriesExpanded] = useState(false);
  const dashboardAsOf = currentDateKey();
  const dataAsOf = useMemo(() => latestVerifiedDataDate(data, dashboardAsOf), [data, dashboardAsOf]);
  const pipelineReturnRef = useRef<{
    tab: Tab;
    overviewView: OverviewView;
    category: string;
    search: string;
    productPage: number;
    studioScope: "总览" | "国内" | "海外";
    selectedStudioName: string | null;
    scrollY: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(publicAssetUrl(`/dashboard_data.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/games.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/pipeline-icons.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/databrain_trends.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/databrain_trends_90d.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/databrain_latest_metrics.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/databrain_snapshots.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/video-covers.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/pc-metrics.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/development-profiles.json?v=${DATA_VERSION}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/pc-trends.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.json()),
      fetch(publicAssetUrl(`/databrain_events.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.ok ? response.json() : ({ games: {} })).catch(() => ({ games: {} })),
      fetch(publicAssetUrl(`/databrain_research.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.ok ? response.json() : ({ games: {} })).catch(() => ({ games: {} })),
      fetch(publicAssetUrl(`/youyansuo_discovery.json?v=${DATA_VERSION}&t=${Date.now()}`)).then((response) => response.ok ? response.json() : null).catch(() => null),
    ])
      .then(([dashboard, enriched, pipelineIcons, trendBundle, trend90dBundle, latestMetricBundle, snapshotBundle, videoCoverBundle, pcMetricBundle, developmentProfiles, pcTrendBundle, eventBundle, researchBundle, discoveryBundle]) => {
        if (discoveryBundle?.meta?.status === "imported" && Array.isArray(discoveryBundle.candidates) && Array.isArray(discoveryBundle.tracked_updates)) setDiscovery(discoveryBundle);
        const confirmedNames = new Set(Object.entries(verifiedReleases).filter(([, release]) => release.date <= currentDateKey()).map(([name]) => name));
        const normalizeStudio = (studio: StudioRecord) => {
          const pipelineEntries = studio.known_pipeline || [];
          const moved = pipelineEntries.map(studioPipelineName).filter(name => confirmedNames.has(name));
          return { ...studio, known_pipeline: pipelineEntries.filter(entry => !confirmedNames.has(studioPipelineName(entry))), known_published: [...new Set([...(studio.known_published || []), ...moved])] };
        };
        dashboard.domesticStudios = (dashboard.domesticStudios as StudioRecord[]).map(normalizeStudio);
        dashboard.overseasStudios = Object.fromEntries(Object.entries(dashboard.overseasStudios as Record<string, StudioRecord>).map(([name, studio]) => [name, normalizeStudio(studio)]));
        dashboard.pipelineGroups = (dashboard.pipelineGroups as PipelineGroup[]).map(group => ({ ...group, projects: group.projects.filter(name => !confirmedNames.has(name)) }));
        for (const name of confirmedNames) {
          const release = verifiedReleases[name];
          const detail = dashboard.pipelineDetails[name];
          if (detail) {
            detail.stage = release.status;
            detail.stage_date = release.date;
            detail.release_status = release.status;
            detail.testing = { ...detail.testing, records: [...recordList(detail.testing?.records).filter(item => dateKey(recordText(item, "date")) !== release.date), { date: release.date, type: "正式上线", title: release.status, summary: release.status, status: "confirmed", source: "官方渠道核验", url: release.source }] };
          }
          for (const collection of [dashboard.games, enriched.games] as Game[][]) {
            let game = collection.find(item => item.name === name);
            if (!game) { game = { name, category: detail?.category, developer: detail?.developer, icon_path: pipelineIcons[name]?.path }; collection.push(game); }
            Object.assign(game, { status: release.status, release_status: release.status, release_date: release.date, platform: release.platform, lifecycle: { ...game.lifecycle, pipeline: false, stage: release.status }, platform_release_status: release.status, release_source: release.source });
          }
        }
        for (const [name, records] of Object.entries(researchBundle?.games || {}) as Array<[string, unknown]>) {
          const detail = dashboard.pipelineDetails[name];
          if (detail) detail.media_reports = mergeResearchRecords(detail.media_reports, records, true);
        }
        const videoCovers = Object.fromEntries(Object.entries(videoCoverBundle || {}).filter(([, value]) => typeof value === "object" && value && "path" in value).map(([key, value]) => [key, (value as { path: string }).path]));
        const videoCoverStatus = Object.fromEntries(Object.entries(videoCoverBundle || {}).map(([key, value]) => [key, typeof value === "object" && value && "path" in value ? "ready" : "unavailable"]));
        const mergedGames = mergeGames(enriched.games || [], dashboard.games || [], trendBundle?.games || {}, trend90dBundle?.games || {}, snapshotBundle?.games || {}, latestMetricBundle?.mobile_games || {}).map((game) => ({
          ...game,
          intelligence: {
            ...(game.intelligence || {}),
            recent_articles: mergeResearchRecords(game.intelligence?.recent_articles, researchBundle?.games?.[game.name], false),
          },
        }));
        const pipelineNames = pipelineGroupNameSet(dashboard.pipelineGroups || [], true, Object.keys(dashboard.pipelineDetails || {}));
        setData({ ...dashboard, pcTrends: pcTrendBundle?.games || {}, databrainEvents: eventBundle?.games || {}, databrainResearch: researchBundle?.games || {}, pipelineIcons: pipelineIcons || {}, trendMeta: trend90dBundle?.meta || trendBundle?.meta || {}, videoCovers, videoCoverStatus, pcMetrics: mergeMetricMaps(pcMetricBundle?.games || {}, latestMetricBundle?.pc_games || {}), games: attachReleasedDevelopmentProfiles(mergedGames, pipelineNames, developmentProfiles || {}) });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);

  useEffect(() => {
    const syncStudioRoute = () => {
      const name = new URL(window.location.href).searchParams.get("studio");
      setSelectedStudioName(name);
      if (name) {
        setTab("pipeline");
      }
    };
    syncStudioRoute();
    window.addEventListener("popstate", syncStudioRoute);
    return () => window.removeEventListener("popstate", syncStudioRoute);
  }, []);

  const trackedPipelineNames = useMemo(() => pipelineGroupNameSet(data.pipelineGroups || [], true, Object.keys(data.pipelineDetails || {})), [data.pipelineGroups, data.pipelineDetails]);
  const activePipelineNames = useMemo(() => pipelineGroupNameSet(data.pipelineGroups || [], false, Object.keys(data.pipelineDetails || {})), [data.pipelineGroups, data.pipelineDetails]);
  const headlineGames = useMemo(() => data.games.filter((game) => isHeadlineProduct(game, trackedPipelineNames)), [data.games, trackedPipelineNames]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    headlineGames.forEach((game) => counts.set(game.category || "其他类", (counts.get(game.category || "其他类") || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [headlineGames]);

  const games = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const pcMetrics = data.pcMetrics || {};
    const candidates = keyword ? data.games.filter((game) => !game.alias_of) : headlineGames;
    return candidates
      .filter((game) => category === "全部" || game.category === category)
      .filter((game) => !keyword || [game.name, game.name_cn, game.name_zh, game.en, game.name_en, ...(Array.isArray(game.aliases) ? game.aliases : []), game.developer, game.publisher, game.category].some((value) => String(value || "").toLowerCase().includes(keyword)))
      .sort((a, b) => {
        const aValue = rankingMetric === "mobile_dau" ? mobileDau(a) : pcAcu(a, pcMetrics);
        const bValue = rankingMetric === "mobile_dau" ? mobileDau(b) : pcAcu(b, pcMetrics);
        if (aValue === null && bValue === null) return a.name.localeCompare(b.name, "zh-CN");
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return bValue - aValue || a.name.localeCompare(b.name, "zh-CN");
      });
  }, [data.games, headlineGames, category, search, rankingMetric, data.pcMetrics]);

  const productPageCount = Math.max(1, Math.ceil(games.length / PRODUCT_PAGE_SIZE));
  const currentProductPage = Math.min(productPage, productPageCount);
  const productPageStart = (currentProductPage - 1) * PRODUCT_PAGE_SIZE;
  const productPageEnd = Math.min(productPageStart + PRODUCT_PAGE_SIZE, games.length);
  const paginatedGames = games.slice(productPageStart, productPageEnd);

  const allPipeline = Object.entries(data.pipelineDetails || {});
  const pipeline = allPipeline.filter(([name]) => activePipelineNames.has(name));
  const pipelineGroups = data.pipelineGroups?.length ? data.pipelineGroups : [{ name: "重点项目", projects: pipeline.map(([name]) => name) }];
  const researchPipelineGroups = pipelineGroups.filter((group) => group.name !== PIPELINE_VALIDATION_GROUP);
  const pipelineGameMap = new Map(data.games.map((game) => [game.name, game]));
  Object.entries(data.pipelineDetails || {}).forEach(([name, detail]) => {
    const knownGame = pipelineGameMap.get(name);
    pipelineGameMap.set(name, {
      ...detail,
      ...knownGame,
      name,
      category: knownGame?.category || detail.category || pipelineCategoryFor(name),
      developer: knownGame?.developer || detail.developer,
      pipeline_team: detail.team,
      icon_path: knownGame?.icon_path || data.pipelineIcons[name]?.path,
    });
  });
  const pipelineIconMap = data.pipelineIcons || {};
  const pipelineDirectionByProject = new Map<string, string>(PIPELINE_CATEGORIES.flatMap((direction) => direction.projects.map((name) => [name, direction.id] as const)));
  const pipelineDirectionStats = PIPELINE_CATEGORIES.map((direction) => {
    const items = direction.projects.filter((name) => activePipelineNames.has(name)).map((name) => data.pipelineDetails[name]).filter(Boolean);
    return { ...direction, count: items.length, highConfidence: items.filter((item) => item.confidence === "高").length };
  }).sort((a, b) => b.count - a.count);
  let pipelineDirectionOffset = 0;
  const pipelineDirectionSlices = pipelineDirectionStats.map((direction) => {
    const start = pipelineDirectionOffset;
    const share = pipeline.length ? direction.count / pipeline.length * 100 : 0;
    pipelineDirectionOffset += share;
    return { ...direction, start, end: pipelineDirectionOffset, share };
  });
  const pipelineDirectionGradient = `conic-gradient(${pipelineDirectionSlices.map((direction) => `${direction.color} ${direction.start}% ${direction.end}%`).join(", ")})`;
  const vendorDirectionRows = researchPipelineGroups.map((group) => ({
    ...group,
    segments: PIPELINE_CATEGORIES.map((direction) => {
      const count = group.projects.filter((name) => pipelineDirectionByProject.get(name) === direction.id).length;
      return { id: direction.id, label: direction.shortLabel, count, width: group.projects.length ? count / group.projects.length * 100 : 0 };
    }).filter((segment) => segment.count > 0),
  }));
  const pipelineStageMatrixRows: PipelineMatrixRow[] = PIPELINE_MATRIX_CATEGORIES.map((categoryGroup) => ({
    id: categoryGroup.id,
    label: categoryGroup.label,
    color: categoryGroup.color,
    entries: categoryGroup.projects
      .filter((name) => activePipelineNames.has(name) && Boolean(data.pipelineDetails[name]))
      .map((name) => pipelineMatrixEntry(name, data.pipelineDetails[name], pipelineGameMap.get(name) || { name, icon_path: pipelineIconMap[name]?.path }, dashboardAsOf)),
  })).filter((row) => row.entries.length > 0);
  const recentLaunches = useMemo(() => buildRecentLaunchEntries(data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf), [data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf]);
  const radarEvents = useMemo(() => buildRadarEvents(headlineGames, data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf), [headlineGames, data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf]);
  const versionChangedGameNames = useMemo(() => new Set(
    radarEvents
      .filter((event) => event.productType === "热门游戏" && event.kind === "版本更新")
      .map((event) => event.game.name),
  ), [radarEvents]);
  const strategicPipelineNames = useMemo(() => new Set(data.domesticStudios.flatMap((studio) => (studio.known_pipeline || []).map(studioPipelineName))), [data.domesticStudios]);
  const strategicPipelineEvents = useMemo(() => buildStrategicPipelineEvents(strategicPipelineNames, data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf), [strategicPipelineNames, data.pipelineDetails, data.pipelineIcons, data.games, dashboardAsOf]);
  const categoryInsights = useMemo(() => buildCategoryInsights(headlineGames, radarEvents, strategicPipelineEvents, data.categoryMeta, strategicPipelineNames, data.games), [headlineGames, radarEvents, strategicPipelineEvents, data.categoryMeta, strategicPipelineNames, data.games]);
  const videoCovers = { ...VIDEO_THUMBNAILS, ...(data.videoCovers || {}) };
  const videoCoverStatus = data.videoCoverStatus || {};
  const studioBios = data.studioBios || {};
  const overseasEntries = Object.entries(data.overseasStudios || {});
  const studioTiers = ["T1_必追踪", "T2_应追踪", "T3_观察"];
  const focusDomesticStudios = data.domesticStudios.filter((studio) => studio.name === "巨人" || Boolean(studio.business_profile) || (pipelineGroups.find((group) => group.name === studio.name)?.projects.length || 0) > 0);
  const focusDomesticEntries = focusDomesticStudios.map((studio, index) => ({ studio, index }));
  const selectedStudio = selectedStudioName ? data.domesticStudios.find((studio) => studio.name === selectedStudioName) || Object.entries(data.overseasStudios || {}).map(([name, studio]) => ({ ...studio, name })).find((studio) => studio.name === selectedStudioName) : undefined;
  const selectedPipelineItem = selectedPipeline ? data.pipelineDetails[selectedPipeline] : null;
  const selectedAssessment = isStructuredAssessment(selectedPipelineItem?.assessment) ? selectedPipelineItem.assessment : null;
  const selectedEvidenceSections = selectedPipelineItem ? pipelineEvidenceSections(selectedPipelineItem, selectedAssessment) : { internal: [], playtest: [], media: [] };
  const selectedPipelineTesting = selectedPipelineItem?.testing;
  const selectedPipelineGroup = selectedPipeline ? pipelineGroups.find((group) => group.projects.includes(selectedPipeline)) : null;
  const selectedIsReleased = selected ? isReleasedProduct(selected) : false;
  const selectedRawPcMetrics = selected ? data.pcMetrics?.[selected.name] : undefined;
  const selectedMobileMetrics = selected?.metrics && isMobileMetricScope(selected.metrics.platform, productPlatformText(selected)) && [selected.metrics.dau, selected.metrics.mau, selected.metrics.monthly_revenue].some((value) => value !== null && value !== undefined) ? selected.metrics : undefined;
  const selectedPcMetrics = selectedRawPcMetrics && [selectedRawPcMetrics.average_ccu, selectedRawPcMetrics.peak_ccu, selectedRawPcMetrics.revenue_30d, selectedRawPcMetrics.sales_units, selectedRawPcMetrics.reviews_count, selectedRawPcMetrics.review_score].some((value) => value !== null && value !== undefined) ? selectedRawPcMetrics : undefined;
  const selectedPlatformText = selected ? productPlatformText(selected) : "";
  const selectedHasMobilePlatform = Boolean(selectedMobileMetrics || /移动|ios|android|小游戏|mobile/i.test(selectedPlatformText));
  const selectedHasPcPlatform = Boolean(selectedPcMetrics || /\bpc\b|steam/i.test(selectedPlatformText));
  const selectedHasConsolePlatform = /主机|switch|playstation|ps[45]|xbox|nintendo/i.test(selectedPlatformText);
  const selectedPcTrend = selected ? data.pcTrends?.[selected.name] : undefined;
  const selectedRawTrend = selected?.metrics_trend_30d;
  const selectedTrendPoints = selectedRawTrend?.activity?.points || [];
  const selectedTrendValues = selectedTrendPoints.map((point: { value?: number }) => Number(point.value)).filter((value: number) => Number.isFinite(value) && value >= 0).sort((a: number, b: number) => a - b);
  const selectedTrendMedian = selectedTrendValues.length ? selectedTrendValues[Math.floor(selectedTrendValues.length / 2)] : null;
  const selectedTrendScopeIsPc = /steam|pc/i.test(`${selectedRawTrend?.activity?.scope || ""} ${selectedRawTrend?.activity?.label || ""}`);
  const selectedPcTrendMismatch = Boolean(!selectedMobileMetrics && selectedPcMetrics && selectedTrendValues.length && (!selectedTrendScopeIsPc || (selectedPcMetrics.average_ccu !== null && selectedTrendMedian !== null && (selectedTrendMedian > selectedPcMetrics.average_ccu * 4 || selectedTrendMedian < selectedPcMetrics.average_ccu / 4))));
  const selectedTrend = selectedPcTrendMismatch ? undefined : selectedRawTrend;
  const currentTab = tabs.find((item) => item.id === tab)!;
  const showCategoryOverview = tab === "games" && overviewView === "categories" && !search.trim();
  const showProductRanking = tab === "games" && overviewView === "ranking";
  const showStudioOverview = tab === "pipeline" && !selectedPipeline;
  const showFocusTeamStudio = Boolean(selectedStudio && FOCUS_TEAM_STUDIOS.has(selectedStudio.name));
  const showResearchSidebar = tab === "games";
  const showStudioSidebar = tab === "pipeline" && !selectedPipeline && !selectedStudio;
  const showSidebar = showResearchSidebar || showStudioSidebar;
  const currentTitle = tab === "games" ? showCategoryOverview ? "品类观测总览" : category === "全部" ? "产品榜" : category : selectedStudio?.name || selectedPipeline || currentTab.label;
  const currentDescription = tab === "games" ? showCategoryOverview ? "先看各品类在研产品进展与热门游戏重大更新，再下钻产品和厂商验证具体信号。" : search.trim() ? `找到 ${games.length} 款匹配产品；搜索覆盖中文名、英文名与历史代号。` : `浏览 ${games.length} 款已上线休闲互动产品，按核心指标比较头部样本。` : selectedStudio ? "查看厂商产品组合、在研方向、组织信息与近期经营信号。" : selectedPipeline ? "项目研发阶段、玩法结构、实机证据与编辑研判。" : "集中查看重点厂商画像、在研储备与项目验证进展。";

  const updateStudioUrl = (name: string | null, method: "pushState" | "replaceState" = "pushState") => {
    const url = new URL(window.location.href);
    if (name) url.searchParams.set("studio", name);
    else url.searchParams.delete("studio");
    window.history[method]({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const chooseTab = (next: Tab) => {
    setTab(next);
    setSelectedPipeline(null);
    setSelectedStudioName(null);
    updateStudioUrl(null, "replaceState");
    if (next === "games") {
      setOverviewView("categories");
      setCategory("全部");
      setSearch("");
      setProductPage(1);
    }
    if (next === "pipeline") setStudioScope("总览");
    if (next !== "games") setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCategory = (name: string) => {
    setTab("games");
    setOverviewView("ranking");
    setCategory(name);
    setSearch("");
    setProductPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseRankingMetric = (metric: RankingMetric) => {
    setRankingMetric(metric);
    setProductPage(1);
  };

  const openPipelineDetail = (name: string) => {
    if (!selectedPipeline) {
      pipelineReturnRef.current = { tab, overviewView, category, search, productPage, studioScope, selectedStudioName, scrollY: window.scrollY };
    }
    setTab("pipeline");
    setSelected(null);
    setSelectedStudioName(null);
    updateStudioUrl(null, "replaceState");
    setSelectedPipeline(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closePipelineDetail = () => {
    const returnState = pipelineReturnRef.current;
    setSelectedPipeline(null);
    if (returnState) {
      setTab(returnState.tab);
      setOverviewView(returnState.overviewView);
      setCategory(returnState.category);
      setSearch(returnState.search);
      setProductPage(returnState.productPage);
      setStudioScope(returnState.studioScope);
      setSelectedStudioName(returnState.selectedStudioName);
      updateStudioUrl(returnState.selectedStudioName, "replaceState");
    } else {
      setTab("pipeline");
      setStudioScope("总览");
    }
    pipelineReturnRef.current = null;
    window.requestAnimationFrame(() => window.scrollTo({ top: returnState?.scrollY || 0, behavior: "auto" }));
  };

  const openStudio = (name: string) => {
    setTab("pipeline");
    setStudioScope(data.domesticStudios.some((studio) => studio.name === name) ? "国内" : "海外");
    setSelectedStudioName(name);
    setSelected(null);
    setSelectedPipeline(null);
    updateStudioUrl(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeStudio = () => {
    setSelectedStudioName(null);
    updateStudioUrl(null, "replaceState");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRadarEvent = (event: RadarEvent) => {
    if (event.target === "pipeline" && event.productType === "在研新品") {
      openPipelineDetail(event.game.name);
    } else {
      setSelected(data.games.find(game => game.name === event.game.name) || event.game);
    }
  };

  const chooseOverviewView = (next: OverviewView) => {
    setTab("games");
    setOverviewView(next);
    setCategory("全部");
    setSearch("");
    setProductPage(1);
    setSelected(null);
    setSelectedPipeline(null);
    setSelectedStudioName(null);
    updateStudioUrl(null, "replaceState");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseStudioScope = (next: "总览" | "国内" | "海外") => {
    setStudioScope(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToProductPage = (nextPage: number) => {
    setProductPage(Math.min(Math.max(nextPage, 1), productPageCount));
    document.querySelector(".ranking-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => chooseTab("games")} aria-label="返回品类总览">
          <span className="brand-mark">C</span>
          <span className="brand-copy"><strong>Casual Radar</strong><small>休闲互动游戏研究</small></span>
        </button>
        <nav aria-label="主导航">
          {tabs.map((item) => <button className={tab === item.id ? "active" : ""} onClick={() => chooseTab(item.id)} key={item.id}>{item.label}</button>)}
        </nav>
        <label className="search-box">
          <span>⌕</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setProductPage(1); }} onFocus={() => { setTab("games"); setOverviewView("ranking"); setCategory("全部"); setProductPage(1); setSelectedPipeline(null); setSelectedStudioName(null); updateStudioUrl(null, "replaceState"); }} placeholder="搜索游戏、厂商或玩法" />
          <kbd>⌘ K</kbd>
        </label>
      </header>

      {showSidebar && <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"} aria-label={showStudioSidebar ? "固定厂商导航" : "固定研究导航"}>
        <div className="sidebar-toolbar"><strong>{showStudioSidebar ? "厂商导航" : "研究导航"}</strong><button className="sidebar-toggle" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-expanded={!sidebarCollapsed} aria-controls={showStudioSidebar ? "studio-sidebar-navigation" : "research-sidebar-navigation"} aria-label={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"} title={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}><span aria-hidden="true" /></button></div>
        {showStudioSidebar ? <>
          <nav className="side-view-nav" id="studio-sidebar-navigation" aria-label="厂商范围">
            <p className="side-label">厂商视图</p>
            <button className={studioScope === "总览" ? "side-view-link studio-overview-link active" : "side-view-link studio-overview-link"} onClick={() => chooseStudioScope("总览")}><i>00</i><span>总览面板</span><b>{focusDomesticStudios.length + overseasEntries.length}</b></button>
            <div className="studio-scope-branches">
              <p className="side-label">厂商地区</p>
              <button className={studioScope === "国内" ? "side-view-link studio-scope-link active" : "side-view-link studio-scope-link"} onClick={() => chooseStudioScope("国内")}><i>01</i><span>国内厂商</span><b>{focusDomesticStudios.length}</b></button>
              <button className={studioScope === "海外" ? "side-view-link studio-scope-link active" : "side-view-link studio-scope-link"} onClick={() => chooseStudioScope("海外")}><i>02</i><span>海外厂商</span><b>{overseasEntries.length}</b></button>
            </div>
          </nav>
          <div className="side-status"><span /><div><strong>{studioScope === "总览" ? focusDomesticStudios.length + overseasEntries.length : studioScope === "国内" ? focusDomesticStudios.length : overseasEntries.length} 家重点厂商</strong><small>{studioScope === "总览" ? "国内与海外重点跟踪池" : `当前展示${studioScope}厂商`}</small></div></div>
        </> : <>
          <nav className="side-view-nav" id="research-sidebar-navigation" aria-label="研究视图">
            <p className="side-label">研究视图</p>
            <button className={showCategoryOverview ? "side-view-link active" : "side-view-link"} onClick={() => chooseOverviewView("categories")}><i>01</i><span>品类总览</span></button>
            <div className="ranking-nav-row">
              <button className={showProductRanking ? "side-view-link active" : "side-view-link"} onClick={() => chooseOverviewView("ranking")}><i>02</i><span>产品榜</span></button>
              <button className="ranking-categories-toggle" aria-label={rankingCategoriesExpanded ? "收起产品榜品类" : "展开产品榜品类"} aria-expanded={rankingCategoriesExpanded} aria-controls="ranking-category-branches" onClick={() => { setRankingCategoriesExpanded(value => !value); if (sidebarCollapsed) setSidebarCollapsed(false); }}><span aria-hidden="true">{rankingCategoriesExpanded ? "▾" : "▸"}</span></button>
            </div>
          <div id="ranking-category-branches" className="ranking-category-branches" hidden={!rankingCategoriesExpanded}>
          <p className="side-label side-catalog-label">品类目录</p>
          {Object.entries(
            categories.reduce<Record<string, Array<[string, number]>>>((groups, item) => {
              const group = data.categoryMeta[item[0]]?.group || "其他";
              (groups[group] ||= []).push(item);
              return groups;
            }, {})
          ).map(([group, items]) => (
            <div className="side-group" key={group}>
              <p className="side-label">{group}</p>
              {items.map(([name, count], index) => (
                <button className={showProductRanking && category === name ? "side-link active" : "side-link"} onClick={() => openCategory(name)} key={name}>
                  <i>{String.fromCharCode(65 + index)}{index + 1}</i><span>{name.replace("社交-", "")}</span><b>{count}</b>
                </button>
              ))}
            </div>
          ))}
          </div>
          </nav>
          <div className="side-status"><span /><div><strong>数据已载入</strong><small>指标更新至 {shortDate(dataAsOf)}</small></div></div>
        </>}
      </aside>}

      <main className={showSidebar ? sidebarCollapsed ? "sidebar-collapsed" : "" : "main-full"}>
        <section className={`page-hero${selectedPipeline || showFocusTeamStudio ? " page-hero-detail" : tab === "pipeline" ? " page-hero-pipeline" : showProductRanking ? " page-hero-ranking" : showCategoryOverview || showStudioOverview ? " page-hero-overview" : ""}`}>
          <div>
            <p className="eyebrow">{currentTab.kicker}</p>
            <h1>{currentTitle}</h1>
            <p>{currentDescription}</p>
            {showProductRanking && <nav className="ranking-category-shortcuts" aria-label="产品榜品类快捷入口">
              <button aria-pressed={category === "全部"} onClick={() => openCategory("全部")}>全部品类</button>
              {categories.map(([name]) => <button key={name} aria-pressed={category === name} onClick={() => openCategory(name)}>{name.replace("社交-", "")}</button>)}
            </nav>}
          </div>
        </section>

        {showCategoryOverview && (
          <CategoryOverview
            discovery={discovery}
            insights={categoryInsights}
            releasedGames={headlineGames}
            matrixRows={pipelineStageMatrixRows}
            signalEvents={latestRadarEventsByProduct(radarEvents, "全部")}
            pipelineProducts={pipeline.map(([name]) => pipelineGameMap.get(name)).filter((game): game is Game => Boolean(game))}
            allGames={data.games}
            recentLaunches={recentLaunches}
            asOf={dashboardAsOf}
            onOpenCategory={openCategory}
            onOpenGame={setSelected}
            onOpenEvent={openRadarEvent}
            onOpenPipeline={openPipelineDetail}
          />
        )}

        {showProductRanking && (
          <section className="workspace ranking-workspace">
            <div className="toolbar">
              <button className="back-overview" onClick={() => chooseOverviewView("categories")}><span>←</span> 返回上一页</button>
            </div>


            <div className="table-card">
              <div className="table-title ranking-table-title">
                <div className="ranking-title-copy">
                  <p className="eyebrow">CASUAL PRODUCT RANKING</p>
                  <h2>{search.trim() ? "产品搜索结果" : category === "全部" ? "休闲产品整体排行" : `${category}产品排行`}</h2>
                </div>

              </div>
              <div className="game-table" role="table" aria-label="产品样本">
                <div className="game-row game-head" role="row">
                  <span role="columnheader">产品</span>
                  <span role="columnheader">品类 / 类型</span>
                  <span role="columnheader">平台</span>
                  <span className={rankingMetric === "mobile_dau" ? "active-sort" : ""} role="columnheader" aria-sort={rankingMetric === "mobile_dau" ? "descending" : "none"}>
                    <button type="button" className="ranking-sort-button" onClick={() => chooseRankingMetric("mobile_dau")} aria-pressed={rankingMetric === "mobile_dau"} aria-label="按移动端 DAU 降序排列">
                      移动端 DAU {rankingMetric === "mobile_dau" && <i aria-hidden="true">↓</i>}
                    </button>
                  </span>
                  <span className={rankingMetric === "pc_acu" ? "active-sort" : ""} role="columnheader" aria-sort={rankingMetric === "pc_acu" ? "descending" : "none"}>
                    <button type="button" className="ranking-sort-button" onClick={() => chooseRankingMetric("pc_acu")} aria-pressed={rankingMetric === "pc_acu"} aria-label="按 PC 端 ACU 降序排列">
                      PC端 ACU {rankingMetric === "pc_acu" && <i aria-hidden="true">↓</i>}
                    </button>
                  </span>
                  <span role="columnheader">资料</span>
                </div>
                {loading ? [1, 2, 3, 4, 5].map((item) => <div className="loading-row" key={item} />) : paginatedGames.map((game) => (
                  <button className={`game-row ${versionChangedGameNames.has(game.name) ? "version-changed" : ""}`} role="row" onClick={() => game.lifecycle?.pipeline === true && data.pipelineDetails[game.name] ? openPipelineDetail(game.name) : setSelected(game)} key={game.name}>
                    <span className="game-name"><GameIcon game={game} /><span><strong>{game.name}</strong><small>{game.developer || game.publisher || game.en || "—"}</small></span></span>
                    <span className="category-cell"><strong>{game.category || "其他类"}</strong><span className="product-status-line"><small className={`product-type ${game.lifecycle?.pipeline === true ? "pipeline" : "live"}`}>{game.lifecycle?.pipeline === true ? "在研新品" : game.pool === "边界观察池" ? "边界观察" : "热门游戏"}</small>{versionChangedGameNames.has(game.name) && <small className="version-change-note">版本变动</small>}</span></span>
                    <span>{game.platform || game.platforms?.join(" / ") || "—"}</span>
                    <span className={`number ${rankingMetric === "mobile_dau" ? "active-sort" : ""}`}>{metricCount(mobileDau(game))}</span>
                    <span className={`number ${rankingMetric === "pc_acu" ? "active-sort" : ""}`}>{metricCount(pcAcu(game, data.pcMetrics || {}))}</span>
                    <span className="arrow">→</span>
                  </button>
                ))}
              </div>
              {games.length > PRODUCT_PAGE_SIZE && <nav className="product-pagination" aria-label="产品榜分页">
                <span>第 {productPageStart + 1}–{productPageEnd} 条，共 {games.length} 条</span>
                <div>
                  <button type="button" onClick={() => goToProductPage(currentProductPage - 1)} disabled={currentProductPage === 1}>上一页</button>
                  {Array.from({ length: productPageCount }, (_, index) => index + 1).map((page) => <button type="button" className={page === currentProductPage ? "active" : ""} aria-current={page === currentProductPage ? "page" : undefined} onClick={() => goToProductPage(page)} key={page}>{page}</button>)}
                  <button type="button" onClick={() => goToProductPage(currentProductPage + 1)} disabled={currentProductPage === productPageCount}>下一页</button>
                </div>
              </nav>}
            </div>
          </section>
        )}

        {showStudioOverview && selectedStudio && <StudioDetailPage studio={selectedStudio} bio={studioBios[selectedStudio.name]} pipelineGameMap={pipelineGameMap} pipelineIconMap={pipelineIconMap} onBack={closeStudio} onOpenPipeline={openPipelineDetail} onOpenGame={setSelected} />}

        {tab === "pipeline" && !selectedPipeline && !selectedStudio && (
          <section className="workspace pipeline-overview-page">
            {studioScope === "总览" && <section className="pipeline-market-overview pipeline-studio-overview">
              <header>
                <div><p className="eyebrow">MARKET CATEGORY MAP</p><h3>厂商在研动向</h3><span>先看各家正在押注哪些主品类，再判断供给是否拥挤。</span></div>
              </header>
              <div className="pipeline-market-grid">
                <article className="pipeline-vendor-direction-map">
                  <header><div><b>厂商 × 在研品类</b><span>条带表示各厂商内部的主品类构成</span></div><small>项目数</small></header>
                  <div className="pipeline-vendor-direction-rows">
                    {vendorDirectionRows.map((group) => (
                      <div className="pipeline-vendor-direction-row" key={group.name}>
                        {data.domesticStudios.some((studio) => studio.name === group.name) || data.overseasStudios[group.name]
                          ? <button className="pipeline-vendor-name-link compact" onClick={() => openStudio(group.name)} aria-label={`查看${group.name}厂商详情`}>{studioGroupLabel(group.name)}</button>
                          : <strong>{studioGroupLabel(group.name)}</strong>}
                        <div className="pipeline-direction-stack" aria-label={studioGroupLabel(group.name) + "品类分布"}>
                          {group.segments.map((segment) => <span className={"direction-" + segment.id} style={{ width: `${segment.width}%` }} title={`${segment.label} ${segment.count} 款`} key={segment.id}><b>{segment.count}</b></span>)}
                        </div>
                        <em>{group.projects.length}</em>
                      </div>
                    ))}
                  </div>
                  <div className="pipeline-direction-legend">{PIPELINE_CATEGORIES.map((direction) => <span key={direction.id}><i className={"direction-" + direction.id} />{direction.shortLabel}</span>)}</div>
                  <p className="pipeline-classification-note">主品类口径：每个项目按当前公开版本的主要循环归入一个主品类；具体研发方向保留在项目说明中。</p>
                </article>
                <article className="pipeline-direction-ranking pipeline-direction-donut-card">
                  <header><div><b>品类供给与验证</b><span>按当前在研样本项目数计算占比</span></div></header>
                  <div className="pipeline-direction-donut-layout">
                    <div className="pipeline-direction-donut" style={{ background: pipelineDirectionGradient }} role="img" aria-label={pipelineDirectionSlices.map((direction) => `${direction.label} ${direction.count} 款`).join("，")}><div><strong>{pipeline.length}</strong><span>款在研样本</span></div></div>
                    <div className="pipeline-direction-donut-legend">{pipelineDirectionSlices.map((direction) => <section key={direction.id}><i style={{ backgroundColor: direction.color }} /><div><header><strong>{direction.label}</strong><b>{direction.count} 款 · {Math.round(direction.share)}%</b></header><p>{direction.signal}</p><small>{direction.highConfidence} 款高置信度 · 代表：{direction.representative}</small></div></section>)}</div>
                  </div>
                </article>
              </div>
            </section>}
            {studioScope !== "海外" && <div className="pipeline-vendor-board-heading">
              <div><p className="eyebrow">STUDIO DIRECTORY</p><h3>{studioScope === "总览" ? "重点厂商在研动向" : "国内厂商"}</h3><span>集中比较重点厂商的已发产品、在研方向、验证进展与具体项目。</span></div>
              <b>{focusDomesticStudios.length}<small>家重点厂商</small></b>
            </div>}
            {studioScope !== "海外" && <section className="pipeline-vendor-board" aria-label="重点厂商在研动向">
              {focusDomesticEntries.map(({ studio, index }) => {
                const group = pipelineGroups.find((item) => item.name === studio.name);
                const directionRow = vendorDirectionRows.find((row) => row.name === studio.name);
                const directionSegments = directionRow?.segments || [];
                const recent = studioNewsArticles(studio, studioBios[studio.name])[0];
                return <article className={`pipeline-vendor-summary-card studio-${index + 1}`} key={studio.name}>
                  <header>
                    <div><button className="pipeline-vendor-name-link" onClick={() => openStudio(studio.name)} aria-label={`查看${studio.name}厂商详情`}>{studio.name}<i>进入厂商详情 →</i></button><p>{studio.track_focus || "持续跟踪公开测试、实机与产品节点"}</p></div>
                    <b>{group?.projects.length || 0}<small>款在研</small></b>
                  </header>
                  <StudioPublishedStrip studio={studio} pipelineGameMap={pipelineGameMap} onOpenGame={setSelected} compact />
                  <div className="pipeline-vendor-mix">
                    <div className="pipeline-vendor-mix-heading"><b>在研品类</b><span>{group?.projects.length || 0} 款 · {directionSegments.length} 类</span></div>
                    <div className="pipeline-direction-stack" aria-label={`${studio.name}在研品类分布`}>
                      {directionSegments.map((segment) => <span className={"direction-" + segment.id} style={{ width: `${segment.width}%` }} title={`${segment.label} ${segment.count} 款`} key={segment.id}><b>{segment.count}</b></span>)}
                    </div>
                    <div className="pipeline-vendor-mix-legend">{directionSegments.map((segment) => <span key={segment.id}><i className={"direction-" + segment.id} /><b>{segment.label}</b><em>{segment.count}</em></span>)}</div>
                  </div>
                  <div className="pipeline-vendor-projects">{group?.projects.length ? group.projects.map((name) => {
                    const item = data.pipelineDetails[name];
                    if (!item) return null;
                    const iconGame = pipelineGameMap.get(name) || { name, icon_path: pipelineIconMap[name]?.path };
                    const evidenceCount = (item.gameplay_videos?.length || 0) + (item.media_reports?.length || 0);
                    return <button className="pipeline-vendor-project" onClick={() => openPipelineDetail(name)} key={name}><GameIcon game={iconGame} className="pipeline-vendor-project-icon" /><span className="pipeline-vendor-project-copy"><span className="pipeline-vendor-project-title"><strong>{name}</strong></span><small>{item.stage || item.release_status || "持续跟踪"}</small><p>{item.assessment?.verdict?.summary || item.analysis?.readiness || item.editor_note || item.analysis?.core_loop || "公开信息仍有限，持续跟踪。"}</p><em><span>资料更新：{item.updated_at || item.stage_date || "日期待确认"}</span><span>{evidenceCount} 条证据</span></em></span></button>;
                  }) : <p className="pipeline-vendor-empty">当前暂无明确在研样本，保留已发产品与厂商详情入口。</p>}</div>
                  {recent?.url && <a className="pipeline-vendor-signal" href={recent.url} target="_blank" rel="noreferrer"><span>最近动态</span><strong>{recent.title || "查看近期厂商动态"}</strong><i>{String(recent.date || "").slice(0, 10)} ↗</i></a>}
                </article>;
              })}
            </section>}
            {studioScope === "海外" && <div className="studio-tier-groups pipeline-overseas-directory">{studioTiers.map((tier) => {
              const entries = overseasEntries.filter(([, studio]) => studio.tier === tier);
              if (!entries.length) return null;
              return <section className="studio-tier-group" key={tier}><header><div><p className="eyebrow">OVERSEAS STUDIO TRACKING</p><h3>{studioTierLabel(tier)}</h3></div><span>{entries.length} 家</span></header><div className="studio-grid">{entries.map(([name, studio], index) => <StudioCard studio={{ ...studio, name }} index={index} overseas bio={studioBios[name]} pipelineGameMap={pipelineGameMap} pipelineIconMap={pipelineIconMap} onOpenStudio={openStudio} onOpenPipeline={openPipelineDetail} onOpenGame={setSelected} key={name} />)}</div></section>;
            })}</div>}
            {studioScope === "总览" && <section className="pipeline-market-overview pipeline-observer-shell">
              {pipelineGroups.filter((group) => !data.domesticStudios.some((studio) => studio.name === group.name) && !data.overseasStudios[group.name]).map((group) => (
                <section className="pipeline-observer-group" aria-label={`${studioGroupLabel(group.name)}项目`} key={group.name}>
                  <header><div><p className="eyebrow">{group.name === PIPELINE_VALIDATION_GROUP ? "PLAYTEST VALIDATION" : "OTHER STUDIO PIPELINE"}</p><h4>{studioGroupLabel(group.name)}</h4></div><span>{group.projects.length} 款项目</span></header>
                  <div className="pipeline-observer-grid">
                    {group.projects.map((name) => {
                      const item = data.pipelineDetails[name];
                      if (!item) return null;
                      const iconGame = pipelineGameMap.get(name) || { name, icon_path: pipelineIconMap[name]?.path };
                      const analysis = item.analysis || {};
                      const evidenceCount = (item.gameplay_videos?.length || 0) + (item.media_reports?.length || 0);
                      return (
                        <button className="pipeline-vendor-project" onClick={() => openPipelineDetail(name)} key={name}>
                          <GameIcon game={iconGame} className="pipeline-vendor-project-icon" />
                          <span className="pipeline-vendor-project-copy">
                            <span className="pipeline-vendor-project-title">
                              <strong>{name}</strong>
                            </span>
                            <small>{item.stage || item.release_status || "持续跟踪"}</small>
                            <p>{item.assessment?.verdict?.summary || analysis.readiness || item.editor_note || analysis.core_loop || "公开信息仍有限，持续跟踪产品完成度与下一轮测试变化。"}</p>
                            <em><span>资料更新：{item.stage_date || "日期待确认"}</span><span>{evidenceCount} 条证据</span></em>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </section>}
          </section>
        )}

        {tab === "pipeline" && selectedPipeline && selectedPipelineItem && (
          <section className="workspace pipeline-detail-page">
            <button className="pipeline-back" onClick={closePipelineDetail} aria-label="返回上一页"><span aria-hidden="true">←</span> 返回上一页</button>
            <article className="pipeline-detail-shell">
              <header className="pipeline-detail-head">
                <div className="pipeline-project-title"><GameIcon game={pipelineGameMap.get(selectedPipeline) || { name: selectedPipeline, icon_path: pipelineIconMap[selectedPipeline]?.path }} className="pipeline-detail-icon" /><div><p>{selectedPipelineGroup?.name || "重点项目"} · {selectedPipelineItem.platforms || "平台待确认"}</p><h2>{selectedPipeline}</h2><div className="pipeline-meta"><span>{selectedPipelineItem.stage_date || "节点待确认"}</span><span>情报置信度 · {selectedPipelineItem.confidence || "中"}</span></div></div></div>
                <div className="stage">{selectedPipelineItem.stage || selectedPipelineItem.release_status || "持续跟踪"}</div>
              </header>
              <ProjectProgressMedia milestones={pipelineMilestones(selectedPipeline, selectedPipelineItem)} media={selectedPipelineItem.gameplay_videos} status={selectedPipelineTesting?.status} thumbnailMap={videoCovers} statusMap={videoCoverStatus} />
              {(selectedPipelineItem.analysis || selectedPipelineItem.gameplay) && <section className="pipeline-detail-section"><div className="section-heading"><p className="eyebrow">GAMEPLAY ANALYSIS</p><h3>玩法与体验</h3></div><div className="pipeline-analysis detail-analysis"><div><b>核心循环</b><p>{selectedPipelineItem.analysis?.core_loop || selectedPipelineItem.gameplay || "公开信息不足"}</p></div><div><b>社交机制</b><p>{selectedPipelineItem.analysis?.social || "公开信息不足"}</p></div><div><b>差异化</b><p>{selectedPipelineItem.analysis?.differentiation || "公开信息不足"}</p></div><div><b>当前完成度</b><p>{selectedPipelineItem.analysis?.readiness || selectedPipelineItem.release_status || "待官方确认"}</p></div></div></section>}
              <PipelineTeamSection name={selectedPipeline} item={selectedPipelineItem} />
              {selectedAssessment ? <StructuredProductAssessment assessment={selectedAssessment} /> : selectedPipelineItem.editor_note && <section className="pipeline-detail-section"><div className="section-heading"><p className="eyebrow">EDITOR'S VIEW</p><h3>看板判断</h3></div><div className="pipeline-detail-judgement">{selectedPipelineItem.editor_note}</div></section>}
              <section className="pipeline-detail-section pipeline-source-section">
                <div className="section-heading heading-with-note"><div><p className="eyebrow">LATEST INTELLIGENCE</p><h3>近期动态与信源</h3></div><span>按信源性质归类，同一内容仅保留一次</span></div>
                <div className="pipeline-evidence-grid pipeline-evidence-grid-three">
                  <EvidenceColumn index="01" title="内部报告" tone="internal" items={selectedEvidenceSections.internal} empty="暂无内部研究报告。" />
                  <EvidenceColumn index="02" title="权威试玩" tone="playtest" items={selectedEvidenceSections.playtest} empty="暂无已核验试玩或实机。" />
                  <EvidenceColumn index="03" title="媒体报告" tone="media" items={selectedEvidenceSections.media} empty="暂无可核验媒体报道。" />
                </div>
              </section>
            </article>
          </section>
        )}

      </main>

      {selected && (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="detail-drawer" aria-label={`${selected.name} 详情`}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="返回上一页"><span aria-hidden="true">←</span> 返回上一页</button>
            <div className="drawer-hero"><div className="drawer-title"><GameIcon game={selected} className="drawer-icon" /><div><span>{selected.category}</span><h2>{selected.name}</h2><p>{selected.en || selected.profile?.developer || selected.developer || ""}</p></div></div><div className="drawer-platform"><small>{selected.platform || selected.platforms?.join(" / ")}</small></div></div>
            <div className="drawer-content">
              {selected.platform_release_status && <p>{selected.platform_release_status} · <a href={selected.release_source} target="_blank" rel="noreferrer">官方状态依据 ↗</a></p>}
              <div className="platform-metrics-stack" aria-label="分平台产品指标">
                {selectedHasMobilePlatform && <section className={`platform-metrics-group ${selectedMobileMetrics ? "" : "platform-metrics-empty"}`}>
                  <header><div><b>移动端</b><span>iOS / Android 数据口径</span></div>{selectedMobileMetrics?.source && <small>{selectedMobileMetrics.source}</small>}</header>
                  {selectedMobileMetrics ? <div className="drawer-metrics mobile-primary-metrics"><div><span>DAU（日频）</span><strong>{compact(selectedMobileMetrics.dau)}</strong><small>{selectedMobileMetrics.dau_data_date ? `截至 ${selectedMobileMetrics.dau_data_date}` : "日活跃用户"}</small></div><div><span>MAU</span><strong>{compact(selectedMobileMetrics.mau)}</strong><small>{selectedMobileMetrics.mau_data_date ? `${selectedMobileMetrics.mau_data_date.slice(0, 7)} 月度口径` : "月活跃用户"}</small></div><div><span>近 30 日收入</span><strong>{money(selectedMobileMetrics.monthly_revenue)}</strong><small>{selectedMobileMetrics.revenue_data_date ? `截至 ${selectedMobileMetrics.revenue_data_date}` : selectedMobileMetrics.data_date ? `截至 ${selectedMobileMetrics.data_date}` : "DataBrain 估算"}</small></div></div> : <p>暂无可核验的独立移动端指标。</p>}
                  {selected.metrics?.scope_note && <p className="chart-note">{selected.metrics.scope_note}</p>}
                  {!selectedTrendScopeIsPc && <ProductTrendPanel game={selected} trend={selectedTrend || { activity: { label: "DAU", unavailable_reason: "尚未接入日频活跃数据，单次指标无法绘制趋势。" }, revenue: { label: "日收入", unavailable_reason: "尚未接入日频收入数据，月度收入无法还原每日趋势。" } }} externalEvents={data.databrainEvents?.[selected.name]} />}
                </section>}
                {selectedHasPcPlatform && <section className={`platform-metrics-group ${selectedPcMetrics ? "" : "platform-metrics-empty"}`}>
                  <header><div><b>PC / Steam</b><span>Steam 数据口径</span></div>{selectedPcMetrics?.source && <small>{selectedPcMetrics.source}</small>}</header>
                  {selectedPcMetrics ? <>
                    <div className="drawer-metrics pc-metrics">
                      <div><span>近 30 日 ACU</span><strong>{metricCount(selectedPcMetrics.average_ccu)}</strong><small>Steam 平均同时在线</small></div>
                      <div><span>{selectedPcMetrics.peak_ccu == null && selectedPcMetrics.historical_peak_ccu != null ? "历史峰值 CCU" : "近 30 日峰值 CCU"}</span><strong>{metricCount(selectedPcMetrics.peak_ccu ?? selectedPcMetrics.historical_peak_ccu)}</strong><small>截至 {selectedPcMetrics.field_sources?.peak_ccu?.date || selectedPcMetrics.field_sources?.historical_peak_ccu?.date || selectedPcMetrics.data_date}</small></div>
                      <div><span>{selectedPcMetrics.lifetime_revenue_estimates ? "累计 PC 收入估算" : "近 30 日收入"}</span><strong>{selectedPcMetrics.lifetime_revenue_estimates ? `${metricMoney(selectedPcMetrics.lifetime_revenue_estimates.min)}–${metricMoney(selectedPcMetrics.lifetime_revenue_estimates.max)}` : metricMoney(selectedPcMetrics.revenue_30d)}</strong><small>{selectedPcMetrics.revenue_30d === null && !selectedPcMetrics.lifetime_revenue_estimates ? "暂无可核验数据" : selectedPcMetrics.revenue_30d === 0 ? "F2P 本体销售额" : "第三方估算"}</small></div>
                      <div><span>{selectedPcMetrics.owner_estimates ? "Steam 持有量估算" : "累计销量"}</span><strong style={selectedPcMetrics.owner_estimates ? { fontSize: "15px", overflowWrap: "anywhere" } : undefined}>{selectedPcMetrics.owner_estimates ? `${metricCount(selectedPcMetrics.owner_estimates.min)}–${metricCount(selectedPcMetrics.owner_estimates.max)}` : metricCount(selectedPcMetrics.sales_units)}</strong><small>{selectedPcMetrics.sales_units === null && !selectedPcMetrics.owner_estimates ? "暂无可核验数据" : selectedPcMetrics.owner_estimates ? "第三方估算范围" : "Steam 本体销量估算"}</small></div>
                      <div><span>Steam 口碑</span><strong>{selectedPcMetrics.review_score_range ? `${selectedPcMetrics.review_score_range[0]}–${selectedPcMetrics.review_score_range[1]}%` : selectedPcMetrics.review_score == null ? "—" : `${selectedPcMetrics.review_score}%`}</strong><small>{selectedPcMetrics.reviews_count == null ? "评价数未覆盖" : `${selectedPcMetrics.reviews_count_approximate ? "约 " : ""}${metricCount(selectedPcMetrics.reviews_count)} 条评价`}</small></div>
                    </div>
                    <details className="pc-metric-source"><summary>数据来源与日期</summary><div className="pc-source-details"><p><a href={selectedPcMetrics.source_url} target="_blank" rel="noreferrer">{selectedPcMetrics.source_url.includes("steamcharts.com") ? "在线数据 · SteamCharts" : selectedPcMetrics.source} · {selectedPcMetrics.data_date} ↗</a></p>{selectedPcMetrics.field_sources?.review_score?.url && selectedPcMetrics.field_sources.review_score.url !== selectedPcMetrics.source_url && <p><a href={selectedPcMetrics.field_sources.review_score.url} target="_blank" rel="noreferrer">Steam 官方评价 · {selectedPcMetrics.field_sources.review_score.date} ↗</a></p>}{selectedPcMetrics.note && <p>{selectedPcMetrics.note}</p>}</div></details>
                  </> : <p>暂无可核验的独立 PC / Steam 指标。</p>}
                  {selectedPcTrend ? <ProductTrendPanel game={selected} trend={selectedPcTrend} externalEvents={data.databrainEvents?.[selected.name]} /> : selectedTrend && selectedTrendScopeIsPc ? <ProductTrendPanel game={selected} trend={selectedTrend} externalEvents={data.databrainEvents?.[selected.name]} /> : <p className="chart-note">DataBrain 尚未返回该 Steam App ID 的日频序列，暂无趋势图。</p>}
                  {!selectedPcTrend && selectedPcTrendMismatch && <p className="platform-trend-empty">原日级趋势与最新 PC 快照的口径或数量级不一致，已暂时隐藏。</p>}
                </section>}
                {selectedHasConsolePlatform && <section className="platform-metrics-group platform-metrics-empty"><header><div><b>主机端</b><span>PlayStation / Xbox / Nintendo 等</span></div></header><p>暂无可核验的独立主机端活跃、收入或销量指标。</p></section>}
              </div>
              {selectedIsReleased ? <ProductIntelligenceBoard game={selected} /> : <>
                <section className="detail-section"><p className="eyebrow">LATEST INTELLIGENCE</p><h3>近期动态</h3><div className="article-list">{recordList(selected.intelligence?.recent_articles).slice(0, 5).map((article, index) => <a href={recordText(article, "url") || "#"} target="_blank" rel="noreferrer" key={index}><span>{shortDate(recordText(article, "date"))}</span><div><strong>{recordText(article, "title")}</strong><small>{recordText(article, "source") || recordText(article, "type") || "公开资料"}</small></div><i>↗</i></a>)}{!recordList(selected.intelligence?.recent_articles).length && <p className="empty">暂无近期文章，继续观察。</p>}</div></section>
                <section className="detail-section"><div className="section-heading heading-with-note"><div><p className="eyebrow">LIFECYCLE MILESTONES</p><h3>产品关键里程碑</h3></div><span>立项、重大测试、版号与公测 · 由早到近</span></div><Timeline items={productMilestones(selected)} empty="暂无可核验的立项、测试、版号或上线节点。" /></section>
              </>}
              <section className="detail-section product-profile-section">
                <div className="section-heading heading-with-note"><div><p className="eyebrow">PROFILE</p><h3>产品信息</h3></div><span>团队信息仅采用可核验公开口径</span></div>
                <dl className="profile-grid product-profile-basic">
                  <div><dt>开发商</dt><dd>{selected.developer || selected.profile?.developer || "未公开"}</dd></div>
                  <div><dt>发行商</dt><dd>{selected.publisher || selected.profile?.publisher || "未公开"}</dd></div>
                  <div><dt>上线时间</dt><dd>{selected.release_date || selected.year || "未公开"}</dd></div>
                  <div><dt>产品状态</dt><dd>{selected.release_status || selected.status || "未公开"}</dd></div>
                  {selected.profile?.gameplay && <div className="product-profile-gameplay"><dt>核心玩法</dt><dd>{selected.profile.gameplay}</dd></div>}
                </dl>
                {selected.development_profile ? <div className="development-profile">
                  <header><div><p>DEVELOPMENT OWNERSHIP</p><h4>{selected.development_profile.team || "具体研发团队未公开"}</h4></div><b>{selected.development_profile.confidence || "公开信源"}</b></header>
                  <dl className="development-profile-grid">
                    <div><dt>所属公司</dt><dd>{selected.development_profile.company || selected.developer || "未公开"}</dd></div>
                    <div><dt>前期开发人数</dt><dd>{selected.development_profile.early_team_size || "未公开"}</dd></div>
                    <div><dt>制作人 / 主策</dt><dd>{selected.development_profile.producer || "未公开"}</dd></div>
                    <div><dt>研发周期</dt><dd>{selected.development_profile.development_cycle || "未公开"}</dd></div>
                    <div className="development-profile-wide"><dt>团队过往经验</dt><dd>{selected.development_profile.prior_experience || "未公开"}</dd></div>
                    <div className="development-profile-wide"><dt>组织归属说明</dt><dd>{selected.development_profile.team_note || "具体事业部 / 工作室未公开"}</dd></div>
                  </dl>
                  {selected.development_profile.sources?.length ? <div className="development-profile-sources"><span>核验信源</span>{selected.development_profile.sources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}><b>{source.label}</b><small>{source.note}</small><i>↗</i></a>)}</div> : null}
                </div> : <p className="development-profile-empty">当前尚未补齐可核验的研发团队与前期规模信息。</p>}
                <p className="description">{selected.description || selected.why || "暂无产品描述。"}</p>
              </section>
              {(selected.intelligence?.videos || []).length > 0 && <section className="detail-section"><div className="section-heading"><p className="eyebrow">VIDEO SAMPLE</p><h3>Demo / 实机视频</h3></div><VideoGallery items={selected.intelligence.videos} thumbnailMap={videoCovers} statusMap={videoCoverStatus} /></section>}
              <section className="source-note"><b>数据说明</b><p>{selectedMobileMetrics && selectedPcMetrics ? "移动端与 PC / Steam 指标按平台分别展示，不合并计算也不直接比较；主机端仅在有独立可核验数据时展示数值。" : selectedPcMetrics ? "PC / Steam 指标按各自信源与日期展示；ACU/CCU 为同时在线而非 DAU，收入和销量只在有可核验口径时填入。" : "产品基础资料来自公开信息整理；移动端 DAU、MAU 与收入为 DataBrain / Sensor Tower 口径的估算值，仅用于横向观察。"}</p></section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
