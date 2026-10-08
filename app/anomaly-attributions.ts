// Editorial hypotheses for the reviewed late-August window, not causal claims.
import type { MetricSignal } from "./metric-anomalies";
import generatedAttributions from "../public/anomaly-attributions.json" with { type: "json" };

type Attribution = { reviewedAt?: string; status?: "hypothesis" | "inconclusive"; summary: string; sources: { label: string; url: string }[] };
const reviewed: Record<string, Attribution> = {
  "金铲铲之战": { summary: "可能与 8/27 版本更新、8/30 五周年活动拉动回流有关；尚不能量化贡献。", sources: [{ label: "8/27 官方更新公告（小米游戏中心）", url: "https://game.xiaomi.com/viewpoint/1378636978_1787797281619_100" }] },
  "云顶之弈": { summary: "同期 18.1 新赛季引入 Wisps 等机制，可能刺激回流与付费；收入增幅不能全部归于新玩法。", sources: [{ label: "Riot 18.1 更新公告", url: "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/" }] },
  "黎明杀机": { summary: "8/26 Chorus of Sin 外观上新可能拉动付费；ACU 未同步增长，暂不归因于玩家规模扩大。", sources: [{ label: "官方外观上新列表", url: "https://deadbydaylight.com/" }] },
  "Palia": { summary: "8/26 新增全服协作公共任务并配合 Twitch 掉宝，可能带动回流；收入增长机制仍待核验。", sources: [{ label: "0.206 官方更新公告", url: "https://www.palia.com/news/patch-206" }, { label: "8/26 Twitch 掉宝活动", url: "https://www.palia.com/news/206-twitch-drops" }] },
  "Dinkum": { summary: "8/25—8/31 Gamescom 本体八折与收入增长重合，促销可能带动销量；不是已确认的新玩法效应。", sources: [{ label: "官方 Gamescom 促销公告", url: "https://store.steampowered.com/oldnews/?appgroupname=Dinkum&appids=1062520&feed=steam_community_announcements" }] },
  "七日世界": { summary: "同期 8/25 更新及 8/26 剧本开服节奏调整，可能带动回流；移动 DAU 的具体贡献待核验。", sources: [{ label: "TapTap 官方公告列表", url: "https://www.taptap.cn/forum/g661147?type=official" }] },
  "索尼克大乱斗": { summary: "媒体记录 IDW 活动与通行证于 8/26 结束，可能有收尾付费；仅与观察周首日重合，解释力较弱。", sources: [{ label: "Sonic City 活动报道（非官方）", url: "https://sonic-city.net/2026/08/08/sonic-rumble-party-launches-idw-clean-sweep-stakes-event-with-surge-tangle-whisper-and-lanolin/" }] },
  "漫威终极逆转": { summary: "二周年活动含 8/29 登录送十连，可能促进回流；国服活动能否解释该序列范围仍待核验。", sources: [{ label: "周年活动报道（叶子猪）", url: "https://news.yzz.cn/domestic/202607-1767713.shtml" }] },
  "方舟：生存进化": { summary: "本轮未找到同期运营事故证据；收入跌幅远大于 ACU，优先核查销量、折扣与估算口径，暂不定因。", sources: [{ label: "ASE 官方公告入口（勿与 ASA 混用）", url: "https://store.steampowered.com/news/app/346110" }, { label: "SteamDB 套装价格记录（仅排查线索）", url: "https://steamdb.info/bundle/21105/" }] },
};

// Each review belongs to a measured window, not to a permanently assigned game cause.
export const ATTRIBUTION_REVIEW_DATE = generatedAttributions.meta.reviewed_at || "2026-09-14";
const SEPTEMBER_REVIEW_DATE = "2026-09-14";
const septemberReview: Record<string, Attribution> = {
  "First Class Trouble": {
    status: "hypothesis", reviewedAt: SEPTEMBER_REVIEW_DATE,
    summary: "可能原因：9/3–9/6 Steam 免费周末叠加每日特惠，降低体验门槛，可能拉动 ACU；活动已核实，贡献未量化。",
    sources: [{ label: "官方：9/3 免费周末与每日特惠", url: "https://steamcommunity.com/app/953880/allnews/" }],
  },
  "Smalland": {
    status: "hypothesis", reviewedAt: SEPTEMBER_REVIEW_DATE,
    summary: "可能原因：8/31 官方宣布生存建造节降价 80%，促销可能带动购买与上线；尚不能量化对本周 ACU、收入的贡献。",
    sources: [{ label: "官方：生存建造节降价 80%", url: "https://steamcommunity.com/app/768200/allnews/" }],
  },
  "创世理想乡": {
    status: "hypothesis", reviewedAt: SEPTEMBER_REVIEW_DATE,
    summary: "可能原因：9/3 六周年内容更新并公布 1.0 计划，可能带动回流与购买；收入增长仍需结合折扣和销量核验。",
    sources: [{ label: "官方：六周年更新与 1.0 计划", url: "https://steamcommunity.com/app/1307550/allnews?l=english" }],
  },
  "Jackbox派对包": {
    status: "inconclusive", reviewedAt: SEPTEMBER_REVIEW_DATE,
    summary: "已查到系列宣传：9/3 公布 Party Pack 12 全部游戏；当前序列未明确具体代际，尚不能据此解释本作 ACU 上涨。",
    sources: [{ label: "官方：9/3 Party Pack 12 内容公布", url: "https://www.jackboxgames.com/blog/here-are-all-5-games-in-the-jackbox-party-pack-12" }],
  },
  "七龙珠：破界斗士": {
    status: "inconclusive", reviewedAt: SEPTEMBER_REVIEW_DATE,
    summary: "已核查官方公告，未找到可解释 9/3–9/9 ACU 上涨的同期事件；活动、促销及回流来源仍待补证。",
    sources: [{ label: "官方：运营公告核查入口", url: "https://adm-dbas.bn-ent.net/en/information/" }],
  },
};

export function anomalyAttribution(name: string, signals: MetricSignal[]): Attribution | undefined {
  if (!signals.length) return undefined;
  const signalKeys = signals.map(s => [s.metric, s.scope, s.start, s.end, s.change > 0 ? "up" : "down"].join("|")).sort();
  const generated = generatedAttributions.games[name as keyof typeof generatedAttributions.games];
  if (generated && JSON.stringify(generated.signalKeys) === JSON.stringify(signalKeys)) return generated as Attribution;
  // Only the reviewed, upward PC observations may use this batch of explanations.
  if (signals.every(s => s.start >= "2026-09-02" && s.end <= "2026-09-09" && s.change > 0 && /PC|Steam/i.test(s.scope) && !/移动|mobile/i.test(s.scope))) {
    return septemberReview[name];
  }
  // Do not carry historical explanations into a new observation window.
  if (signals.some(s => s.start < "2026-08-25" || s.end > "2026-09-02")) return undefined;
  const previous = reviewed[name];
  return previous ? { ...previous, reviewedAt: "2026-09-07" } : undefined;
}
