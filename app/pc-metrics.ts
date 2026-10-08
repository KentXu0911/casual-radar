export function mergeMetricMaps(previous: Record<string, any> = {}, latest: Record<string, any> = {}) {
  return Object.fromEntries([...new Set([...Object.keys(previous), ...Object.keys(latest)])].map((name) => {
    const old = previous[name] || {}, fresh = latest[name] || {};
    const result = { ...old, ...fresh, field_sources: {} as Record<string, {date: string; url: string}> };
    const newest = [old, fresh].sort((a, b) => String(b.data_date || "").localeCompare(String(a.data_date || "")))[0];
    for (const key of ["data_date", "source", "source_url", "confidence", "note"]) {
      result[key] = newest[key] ?? result[key];
    }
    for (const key of ["average_ccu", "peak_ccu", "historical_peak_ccu", "revenue_30d", "sales_units", "review_score", "reviews_count"]) {
      const candidates = [old, fresh].filter(item => typeof item[key] === "number" && Number.isFinite(item[key])).sort((a,b) => String(b.field_sources?.[key]?.date || b.data_date || "").localeCompare(String(a.field_sources?.[key]?.date || a.data_date || "")));
      const chosen = candidates[0];
      result[key] = chosen ? chosen[key] : null;
      if (chosen) result.field_sources[key] = chosen.field_sources?.[key] || { date: chosen.data_date, url: chosen.source_url };
    }
    return [name, result];
  }));
}
