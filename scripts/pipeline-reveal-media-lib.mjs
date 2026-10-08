// Verified reveal media is kept separately from generated research so a refresh
// cannot discard it or move development footage into a later test round.
export function synchronizeRevealMedia(dashboard, gamesDocument, archive) {
  const mergeVideos = (current = [], verified = []) => [
    ...current.filter(item => !verified.some(video => video.url === item.url)),
    ...verified,
  ];
  for (const [name, entry] of Object.entries(archive.products)) {
    const detail = dashboard.pipelineDetails[name];
    if (!detail) continue;
    detail.gameplay_videos = mergeVideos(detail.gameplay_videos, entry.videos);
    const records = detail.testing?.records || [];
    if (entry.milestone && !records.some(item => item.date === entry.milestone.date && item.lifecycle_phase === "project")) {
      const existing = records.find(item => item.date === entry.milestone.date && /首曝|首次公开/.test(item.type || ""));
      if (existing) existing.lifecycle_phase = "project";
      else records.push({ ...entry.milestone });
    }
    for (const record of records) {
      const videos = entry.videos.filter(video => video.milestone_date === record.date);
      if (!videos.length) continue;
      record.media_review = { status: "matched", checked_at: archive.verified_at, scope: "官方首曝 PV、同期开发版本实机及原始发布信息", urls: videos.map(video => video.url) };
    }
    detail.testing = { ...detail.testing, records: records.sort((a, b) => a.date.localeCompare(b.date)) };
    for (const document of [dashboard, gamesDocument].filter(Boolean)) {
      const game = document.games?.find(item => item.name === name);
      if (!game) continue;
      game.intelligence = { ...game.intelligence, videos: mergeVideos(game.intelligence?.videos, entry.videos) };
    }
  }
}
