# Casual Radar｜休闲互动游戏产品看板

公开看板：<https://kentxu0911.github.io/casual-radar/>

源码仓库：<https://github.com/KentXu0911/casual-radar>

## GitHub Pages 发布

`app/page.tsx` 同时供本地预览和静态入口 `static/main.tsx` 使用；Pages 不需要 Node 服务、Cloudflare Worker 或 OpenAI Sites。JSON、图标和实机封面随站点一起发布，项目子路径由 `PAGES_BASE_PATH` 配置。

```bash
npm ci
npm run test:pages
npm run preview:pages
```

静态输出位于 `out/`，默认预览地址为 `http://127.0.0.1:4173/casual-radar/`。`.github/workflows/pages.yml` 在推送 `main` 或手动触发时运行数据检查、原有回归测试和 Pages 构建，全部通过后才部署。构建失败时保留线上上一版。

本地更新和核验完成后，运行：

```bash
npm run github:publish -- --message "Update dashboard data and verified footage"
```

发布前必须 begin/finalize 内容批次。专用发布 checkout 使用 `npm run github:publish -- --in-place --cadence=manual`；从原始目录导出时沿用 `npm run github:publish`。发布器执行内容 gate、完整检查、受控提交、同一提交的 Actions 验证与线上 JSON/应用版本核对，并写入回执。原工作目录的未提交改动不会被提交或重置；公开仓库不包含原 Git 历史、`.env*`、`.openai` 绑定、授权凭证、采集原始产物或本地报告。脚本会拦截常见凭证格式。GitHub Pages 发布的是当前已核验数据，自动发布不会自行完成新品发现、测试实机搜索或数据采集。

采集任务继续在具备 DataBrain/游研所授权的环境运行，完成后调用上述发布命令。凭证不写入浏览器或公开仓库；如以后迁移采集到 Actions，需另行配置 Secrets 和可续期授权。

## 兼容的本地服务构建

原 vinext 构建继续供本地预览与服务端回归检查使用。以下为原模板能力说明：

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## DataBrain 近期事件

DAU 图上的版本、赛季、活动和联动标记来自 `public/databrain_events.json`；公众号、游戏研究所 Pro、GRP 和官方研究内容保存在 `public/databrain_research.json`。两者共用 `public/games.json` 的完整产品实体与别名名单。研究内容按文章发布日期进入产品详情，不会自动变成测试、上线或版本时间轴节点。使用已配置的 `DATABRAIN_TOKEN` 刷新；token 只在本地刷新脚本中使用，不会进入浏览器：

```bash
npm run data:metrics
npm run data:events
npm run build
```

也可以只刷新指定产品，例如 `npm run data:events -- --games=金铲铲之战,蛋仔派对`。查询无结果时会保留上一次成功快照，图表仍会使用看板内已有的公开事件记录作为兜底。

## 自动刷新与发布

自动更新分为每日指标、每日新品/影像核查、每周完整更新与每月历史审计。详细操作、状态和影像 review 格式见 [内容工作流操作手册](specs/content-workflow/operations.md)。

已有数据采集命令：

- `npm run data:daily` 每周二至周日回拉最近 42 天，只重算当前移动端与 PC 指标快照。90 天趋势、事件和异动归因保持到周更，避免日更后归因窗口发生漂移。
- `npm run data:weekly` 每周回拉 104 天，发布最近有效的 90 天趋势，同时对统一实体表中的全部跟踪产品扫描事件与研究资料、刷新异动归因，并运行完整测试。事件和研究扫描都必须达到 `games_queried === tracked_games` 且失败批次为 0，否则回滚且不发布。
- 周更在 DataBrain 流程前由 Codex 使用已授权的 `youyansuo` MCP 扫描模拟经营、自走棋、捉宠、多人合作和轻度 MOBA；完整扫描结果通过 `npm run data:youyansuo -- --input=<scan.json>` 写入独立的 `public/youyansuo_discovery.json`。新品只进待核验候选，已跟踪动态也必须属于当前重点品类，音游、纯 IP 运营等无关产品只记录为排除项；游研所不填 DAU、ACU、收入或趋势。扫描为 `partial`、`internal_only`、未授权、限流或超时都会停止周更并保留上一版快照。
- `npm run data:grp` 将 `public/grp_reports.json` 中已核验的 GRP 报告按中文名、英文名、旧代号和别名归并到产品详情。报告发布日期不会进入产品测试时间轴。

`public/games.json` 的每条 `games[]` 记录是统一产品实体表，`name` 是主名称，`aliases` 是唯一的新增别名入口；中文名、英文名与历史名称字段一并供 DataBrain 指标、事件、GRP、官方/媒体研究、前端搜索和去重使用。不要再增加数据源专用别名字段。

两种任务共用运行锁，DataBrain 原始产物先进入临时目录。覆盖率、日期和构建检查通过后才会提交原始产物；失败时公开 JSON 恢复到上一个正常版本，周更也会恢复 GRP 归并涉及的 `games.json` 与 `dashboard_data.json`。最新报告分别写到 `reports/daily-refresh-latest.json` 和 `reports/weekly-refresh-latest.json`，每次运行的报告同时保存在本地 `reports/history/`。

首次配置计划任务前可运行 `npm run data:daily:dry-run` 和 `npm run data:weekly:dry-run` 检查日期与名单。正式刷新需要环境变量 `DATABRAIN_TOKEN`。

采集后先处理内容/影像队列，执行 `content:finalize` 得到 ready_for_build，再用统一发布器验证构建和线上版本。内容 complete 与 publication.succeeded 分别表示内容/构建通过与线上核验成功；来源 skipped/blocked 不能冒充全量成功。发布器自动记录最新及历史报告，`data:publication` 补录时也会真实检查 Actions 与线上哈希。历史 Sites 回执仍兼容。

公开新闻候选、新产品入池、分类和生命周期判断仍需人工核验；GRP 报告在索引核验后由周更自动按别名归并，游研所情报在品类总览的独立区域展示，不创建新的首页“周报”板块。

品类核验按核心玩法判断：典型二合游戏不因餐厅题材、场景重建或自动烹饪而归入模拟经营看板。Yumtopia 已按编辑反馈排除，后续扫描与晋级均跳过该产品及其商店名称，仅保留排除记录。

2026-10-08 的候选批次仅收录 Project63 与 Dear Passengers，其余候选按编辑决定移出展示并保留排除记录。

更新测试节点时，同步检索对应轮次的官方实机和玩家录播，核验产品、测试名称、发布者、发布时间及链接有效性；视频以 `milestone_date` 明确关联实际测试节点，发布时间单独保留。旧测试录像、PV 和新版实机分别标注。未找到对应实机时，在节点中记录检索范围与结果；不将未检索误写成暂无。开测日期未确认的影像展示在公开影像区，不借视频发布时间推定开测日。

更新首曝节点同样必须检索官方 PV 和同期开发版本实机，区分预告片、开发演示与玩家测试录屏；不能只录文字报道。核验后的影像和首曝日期存入 `public/pipeline-reveal-media.json`，周更、候选晋级和研究归并会重新应用这些关联。节点信源本身是视频时也展示视频卡片；首曝 PV 未确认归属时不自动挂到附近测试。节点保留全部已关联影像，不按条数截断。PV 的公开发布时间只用于已核验的公开节点，不推定开测日期。

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

厂商关联：已入池新品导入和周更会将有明确公司归属及信源的项目同步到厂商名单和在研分组。公司别名使用 `domesticStudios[].company_aliases` 精确匹配；未知、歧义或仅有发行关系的条目保留待核验。厂商研发团队地图复用产品详情的 `team` 数据。
