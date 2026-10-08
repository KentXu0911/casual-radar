import { evaluateMetricSeries } from "../app/metric-anomalies.ts";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function productPlatformText(game) {
  return text(game.platform || (Array.isArray(game.platforms) ? game.platforms.join(" / ") : game.platforms) || game.metrics?.platform);
}

function direction(signal) {
  return signal.change > 0 ? "up" : "down";
}

export function anomalySignalKey(signal) {
  return [signal.metric, signal.scope, signal.start, signal.end, direction(signal)].join("|");
}

function shortDate(value) {
  const [, month, day] = text(value).split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : value;
}

function querySource(gameName, meta) {
  const session = (meta.sessions || []).find((item) => Array.isArray(item.games) && item.games.includes(gameName));
  return session?.system_url ? [{ label: "DataBrain：同期公开事件核查", url: session.system_url }] : [];
}

export function buildAnomalyAttributionBundle({ trends, games, events, asOf, reviewedAt, eventMeta = {} }) {
  const gameMap = new Map((games || []).map((game) => [game.name, game]));
  const output = {};
  let alerts = 0;

  for (const [name, trend] of Object.entries(trends || {})) {
    const game = gameMap.get(name) || { name };
    const signals = ["activity", "revenue"].flatMap((kind) => {
      const result = evaluateMetricSeries(trend, kind, asOf, productPlatformText(game), game.release_date);
      return result.signal?.triggered ? [result.signal] : [];
    });
    if (!signals.length) continue;
    alerts += 1;

    const start = signals.map((signal) => signal.start).sort()[0];
    const end = signals.map((signal) => signal.end).sort().at(-1);
    const matchingEvents = (events?.[name] || [])
      .filter((event) => event.event_date >= start && event.event_date <= end)
      .sort((left, right) => right.event_date.localeCompare(left.event_date));
    const positive = signals.every((signal) => signal.change > 0);
    const sources = matchingEvents
      .filter((event) => /^https?:\/\//.test(text(event.url)))
      .slice(0, 2)
      .map((event) => ({ label: `${event.source || "公开信源"}：${event.title}`, url: event.url }));

    let status = "inconclusive";
    let summary;
    if (matchingEvents.length && positive) {
      const event = matchingEvents[0];
      status = "hypothesis";
      summary = `可能原因：${shortDate(event.event_date)} ${event.title}`;
    } else if (matchingEvents.length) {
      const event = matchingEvents[0];
      summary = `同期事件：${shortDate(event.event_date)} ${event.title}`;
    } else {
      summary = "暂未发现同期事件";
    }

    output[name] = {
      status,
      reviewedAt,
      summary,
      sources: sources.length ? sources : querySource(name, eventMeta),
      signalKeys: signals.map(anomalySignalKey).sort(),
    };
  }

  const covered = Object.values(output).filter((item) => item.sources.length).length;
  return {
    meta: {
      reviewed_at: reviewedAt,
      as_of: asOf,
      event_query_range: eventMeta.query_range || [],
      alerts,
      covered_alerts: covered,
      uncovered_alerts: alerts - covered,
      policy: "每条异动必须绑定当前指标窗口，并记录同期事件或已检索无证据结论。",
    },
    games: output,
  };
}
