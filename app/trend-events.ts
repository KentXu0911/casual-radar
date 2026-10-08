export type TrendEvent = {
  date: string;
  publishedDate?: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  kind: string;
  dateMeaning: "事件日期" | "消息日期";
};

type AnyRecord = Record<string, unknown>;

const EVENT_WORDS = /版本|赛季|更新|联动|周年|活动|测试|上线|公测|发售|促销|免费|折扣|补丁|公告|地图|玩法|发布|定档|预告|新内容|hotfix|patch|season|launch|release|sale|free weekend/i;
const EVENT_SUMMARY_WORDS = /版本|赛季|更新|联动|周年|活动|测试|上线|公测|发售|促销|免费|折扣|补丁|公告|发布|定档|预告|新内容|hotfix|patch|season|launch|release|sale|free weekend/i;
const ANALYSIS_WORDS = /分析|趋势|报告|评测|评论|攻略|盘点|观察|review|analysis|guide/i;

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function list(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function dateKey(value: unknown) {
  const raw = text(value);
  const match = raw.match(/(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${(match[3] || "01").padStart(2, "0")}` : "";
}

function eventKind(item: AnyRecord) {
  const value = `${text(item.kind)} ${text(item.type)} ${text(item.category)} ${text(item.title)} ${text(item.label)} ${text(item.version)} ${text(item.summary)}`;
  if (/测试|test|beta|playtest/i.test(value)) return "测试";
  if (/上线|公测|发售|launch|release/i.test(value)) return "上线";
  if (/活动|联动|周年|促销|免费|折扣|sale|free weekend/i.test(value)) return "活动";
  if (/版本|赛季|更新|补丁|patch|season|hotfix/i.test(value)) return "版本更新";
  return text(item.kind) || text(item.type) || "产品事件";
}

function isLikelyEvent(item: AnyRecord) {
  const title = `${text(item.kind)} ${text(item.type)} ${text(item.category)} ${text(item.title)} ${text(item.version)}`;
  const summary = text(item.summary);
  if (ANALYSIS_WORDS.test(`${title} ${summary}`) && !/公告|上线|测试|发售|促销|活动|联动|周年|patch|launch|release|sale/i.test(title)) return false;
  return EVENT_WORDS.test(title) || (Boolean(summary) && EVENT_SUMMARY_WORDS.test(summary) && !ANALYSIS_WORDS.test(summary));
}

function normalize(item: AnyRecord, fallbackKind = "产品事件", defaultDateMeaning: "事件日期" | "消息日期" = "消息日期"): TrendEvent | null {
  const explicitEventDate = dateKey(item.event_date || item.eventDate || item.occurred_at || item.start_date || item.startDate);
  const date = explicitEventDate || dateKey(item.date || item.published_date || item.publishedAt || item.observed_date || item.timestamp);
  if (!date) return null;
  const title = text(item.title) || text(item.label) || text(item.headline) || text(item.version) || text(item.name) || text(item.event) || "近期产品事件";
  const summary = text(item.summary) || text(item.description) || text(item.message) || text(item.text) || title;
  const source = text(item.source) || text(item.source_name) || text(item.platform) || "公开信源";
  const url = text(item.url) || text(item.source_url) || text(item.link) || undefined;
  const explicitMeaning = text(item.date_meaning);
  const eventMeaning = /事件|发生|上线|开始|发售|更新日期|赛季.*日期|促销.*日期/i.test(explicitMeaning);
  const messageMeaning = /消息|发布|报道|发布日期/i.test(explicitMeaning);
  const dateMeaning = explicitEventDate || eventMeaning ? "事件日期" : messageMeaning ? "消息日期" : defaultDateMeaning;
  const publishedDate = dateKey(item.published_date || item.publishedAt || item.published_at || item.message_date);
  return { date, ...(publishedDate ? { publishedDate } : {}), title, summary, source, url, kind: eventKind(item) || fallbackKind, dateMeaning };
}

function inRange(event: TrendEvent, dates: string[]) {
  if (!dates.length) return true;
  const start = dates.slice().sort()[0];
  const end = dates.slice().sort().at(-1) || start;
  return event.date >= start && event.date <= end;
}

/**
 * Convert DataBrain-style annotations and the dashboard's existing intelligence
 * records into dated chart events. The function intentionally keeps source and
 * date meaning so an article date is never presented as the event date.
 */
export function buildTrendEvents(gameValue: unknown, trendValue: unknown, externalEventsValue?: unknown, eventLimit = 8): TrendEvent[] {
  // Keep the old third-argument limit signature working for callers outside the page.
  let limit = eventLimit;
  if (typeof externalEventsValue === "number") {
    limit = externalEventsValue;
    externalEventsValue = undefined;
  }
  const game = record(gameValue);
  const trend = record(trendValue);
  const intelligence = record(game.intelligence);
  const activity = record(trend.activity);
  const points = [...list(activity.points), ...list(record(trend.revenue).points)]
    .map((point) => dateKey(point.date))
    .filter(Boolean);
  const candidates: TrendEvent[] = [];

  // Explicitly fetched DataBrain rows take precedence over local annotations.
  for (const source of [externalEventsValue, trend.events, trend.annotations, activity.events, activity.annotations, game.events, intelligence.events]) {
    list(source).forEach((item) => {
      const normalized = normalize(item, "产品事件", "事件日期");
      if (normalized) candidates.push(normalized);
    });
  }
  list(intelligence.recent_updates).forEach((item) => {
    const normalized = normalize(item, "版本更新", "事件日期");
    if (normalized) candidates.push(normalized);
  });
  list(intelligence.recent_articles).filter(isLikelyEvent).forEach((item) => {
    const normalized = normalize(item, "产品事件", "消息日期");
    if (normalized) candidates.push(normalized);
  });

  const seen = new Set<string>();
  return candidates
    .filter((event) => inRange(event, points))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-CN"))
    .filter((event) => {
      const key = `${event.date}|${event.url || event.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, limit));
}
