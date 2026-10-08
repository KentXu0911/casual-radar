import { matchesEntityEvidence, queryNamesForGame } from "./weekly-refresh-lib.mjs";

function reportId(report) {
  const direct = Number(report?.id);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const match = String(report?.url || "").match(/[?&]id=(\d+)/);
  return match ? Number(match[1]) : null;
}

function reportTestRound(report) {
  const text = String(report?.title || "");
  const match = text.match(/(首测|一测|二测|三测|四测|终测)/);
  if (!match) return null;
  const label = match[1] === "一测" ? "首测" : match[1];
  return {
    label,
    phase: label === "首测" ? "first" : label === "终测" ? "prelaunch" : "retest"
  };
}

export function matchGrpReports(games, reports) {
  const matches = new Map();
  for (const game of games || []) {
    if (game?.alias_of || !game?.name) continue;
    const names = queryNamesForGame(game);
    const matched = (reports || []).filter((report) => {
      const declaredNames = Array.isArray(report.game_names) ? report.game_names : [];
      return matchesEntityEvidence(names, [report.title, ...declaredNames]);
    });
    if (matched.length) matches.set(game.name, matched);
  }
  return matches;
}

export function syncGrpReports(gamesDocument, dashboard, reportDocument) {
  const reports = Array.isArray(reportDocument?.reports) ? reportDocument.reports : [];
  const matches = matchGrpReports(gamesDocument?.games || [], reports);
  const attached = [];

  for (const [name, matchedReports] of matches) {
    const detail = dashboard?.pipelineDetails?.[name];
    if (!detail) continue;
    const existing = Array.isArray(detail.media_reports) ? detail.media_reports : [];
    const reportUrls = new Set(matchedReports.map((report) => report.url));
    detail.media_reports = [
      ...existing.filter((report) => !reportUrls.has(report.url)),
      ...matchedReports.map((report) => {
        const testRound = reportTestRound(report);
        return {
          date: report.date,
          source: "GRP",
          kind: "测试研究报告",
          title: report.title,
          summary: report.summary,
          url: report.url,
          author: report.author,
          report_id: reportId(report),
          timeline: Boolean(testRound),
          ...(testRound ? {
            lifecycle_phase: testRound.phase,
            timeline_title: `${testRound.label}产品分析`,
            timeline_date_basis: "report_date"
          } : {})
        };
      })
    ].sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
    attached.push(...matchedReports.map((report) => ({ game: name, report_id: reportId(report) })));
  }

  const ids = reports.map(reportId).filter(Number.isInteger);
  gamesDocument.meta = gamesDocument.meta || {};
  gamesDocument.meta.grp_reports_tracked = reports.length;
  gamesDocument.meta.grp_sync_mode = "verified_index; matched by canonical name and aliases";
  dashboard.pipelineMeta = dashboard.pipelineMeta || {};
  dashboard.pipelineMeta.grp_reports = [...new Set([...(dashboard.pipelineMeta.grp_reports || []), ...ids])];
  dashboard.pipelineMeta.grp_report_index_updated_at = reportDocument?.meta?.updated || null;
  return attached;
}
