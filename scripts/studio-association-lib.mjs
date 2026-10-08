const DISCOVERY_GROUP = "游研所新增在研新品";
const productName = (value) => value.replace(/（[^）]*）\s*$/, "").trim();

/** Move already admitted, sourced projects from the discovery bucket to their known company. */
export function synchronizeDiscoveredStudioProducts(dashboard, gamesDocument) {
  const discovery = dashboard.pipelineGroups.find((group) => group.name === DISCOVERY_GROUP);
  if (!discovery) return [];
  const products = new Map(gamesDocument.games.map((game) => [game.name, game]));
  const updates = [];
  for (const name of [...new Set(discovery.projects)]) {
    const game = products.get(name);
    const team = dashboard.pipelineDetails[name]?.team;
    if (game?.lifecycle?.pipeline !== true || game.pool === "边界观察池" || !team?.company || !team.sources?.some((source) => /^https?:\/\//.test(source.url || ""))) continue;
    const matches = dashboard.domesticStudios.filter((studio) => [studio.name, ...(studio.company_aliases || [])].includes(team.company));
    // Unknown and conflicting affiliations stay in the discovery bucket for review.
    if (matches.length !== 1) continue;
    const studio = matches[0];
    studio.known_pipeline ||= [];
    if (!studio.known_pipeline.some((entry) => productName(entry) === name)) studio.known_pipeline.push(name);
    let group = dashboard.pipelineGroups.find((entry) => entry.name === studio.name);
    if (!group) {
      group = { name: studio.name, track_focus: studio.track_focus, projects: [] };
      dashboard.pipelineGroups.push(group);
    }
    if (!group.projects.includes(name)) group.projects.push(name);
    discovery.projects = discovery.projects.filter((entry) => entry !== name);

    const cachedStudio = gamesDocument.meta?.studio_tracking?.domestic_majors?.studios?.find((entry) => entry.name === studio.name);
    if (cachedStudio) {
      cachedStudio.known_pipeline ||= [];
      if (!cachedStudio.known_pipeline.some((entry) => productName(entry) === name)) cachedStudio.known_pipeline.push(name);
    }
    updates.push({ product: name, studio: studio.name });
  }
  return updates;
}
