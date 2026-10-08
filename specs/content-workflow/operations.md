# 内容更新与发布操作

只在专用发布 checkout 执行采集。先检查工作区与 `.automation/content-runs/active/owner.json`；本任务未完成批次可以续跑，其余变更不得覆盖。没有活动批次时，先拉取 main，再开始内容基线。来源或检索失败必须记录为 failed/blocked，不能标记无命中或沿用旧扫描冒充本次扫描。

## 日更、周更与情报更新

- 每日指标：`npm run data:daily -- --skip-build`。只采集最近 42 天并更新当前指标，不改趋势/生命周期。
- 周更：`npm run data:weekly -- --skip-tests --youyansuo-input=/absolute/path/scan.json`。104 天采集、90 天展示，覆盖指标、Steam、事件、研究、GRP、归因与新品。
- 轻量情报：`npm run data:intelligence -- --youyansuo-input=/absolute/path/scan.json`。仅更新新品线索和已跟踪开发动态。
- 月审：`npm run content:begin -- --cadence=monthly`，随后 `npm run content:audit -- --cadence=monthly`，处理全部历史待办。

前三种采集器会先创建完整 public 基线；采集失败恢复整批内容。采集完成是 ready_for_review，仍需编辑验收。若授权来源在 CLI 运行前已经失败，执行 `content:begin`，用下面的模块文件记录来源 blocked，再 finalize 生成失败回执；不留用上次成功报告。来源临时输入和原始响应只放忽略目录或系统临时目录。

已核验内容通过产品与节点 ID 关联。候选区不等于主池；新入池需核心循环、品类、产品身份、平台和可追溯官方证据。开发商、发行商分别填写，不凭同名或文章标题推断主体。既有人工核验字段不能被生成快照覆盖；明确修订直接编辑并记录理由。改变节点标题/URL/日期时保留原 milestone_id。未知事件日期保留 null，视频 date 是上传日，milestone_date 才是已确认事件日。

## 采集故障与检查点

DataBrain 请求显式传递本次 `date_time`。HTTP 失败、日期拒绝、两次空表不能标记为完整扫描。原始事件响应保存在忽略目录 `.automation/databrain-events/`；公开指标的 `meta.refresh_coverage` 区分本轮返回、旧快照保留和未返回指标。

事件/研究查询最多并发 3 批，结果按原批次顺序归并。完整周更仍要求全部批次成功。来源失败时保留失败报告并回滚 public，不允许拿部分扫描声明完整成功。

若同日指标已成功、后续阶段失败，可以保留完整原始 outputs，再以 `--metrics-checkpoint=/absolute/path/outputs` 重跑周更。检查点必须是当天、相同104天请求区间、相同产品清单、全部批次完整且响应 session 与 manifest 一致。它恢复本次已完成采集；`--reuse-metrics` 沿用旧数据，仍不能通过周更指标完成门槛。

## 影像核查

编辑后执行 `npm run content:queue -- --cadence=weekly`（或对应 cadence）。读取 `reports/media-search-queue.json`。新/变化首曝、测试节点是必做任务；历史缺口单列，不会被迁移过程虚报完成。按名称、别名、旧代号检索官方、Bilibili、YouTube；打开结果核验产品与轮次。使用节点 milestone_id 和当前 fingerprint 导入：

```json
{
  "reviews": [{
    "milestone_id": "从队列复制",
    "fingerprint": "从队列复制",
    "checked_at": "2026-10-08",
    "status": "matched",
    "scope": "本次首曝官方PV",
    "searches": [{"query": "实际查询", "platform": "官方", "status": "success"}],
    "videos": [{
      "title": "真实标题", "url": "https://example.com/verified-video",
      "date": "2026-10-07", "milestone_date": "2026-10-08",
      "type": "PV", "scope": "本次首曝", "source": "官方账号",
      "evidence_kind": "video"
    }]
  }]
}
```

真实未找到：status=searched_no_match，提供 searches（每次 query/platform/status=success）及 reason，省略 videos。权限/超时/限流：status=blocked，记录原因及失败查询，不能当作无命中。没有确认事件轮次的影像放公开影像区，node_link_status=unconfirmed，不能关联到相邻测试。替换失效视频时保留旧证据记录并明确失效状态，不直接删除历史证据。

## 完成状态与发布

实际完成编辑后，临时 modules.json 记录 `{"editorial":{"required":true,"status":"passed","checked_at":"实际核验日"}}`；没有完成不能填 passed。自动采集模块来自 runner 报告。周更要求 metrics/steam/intelligence/events/research/editorial；情报更新要求 intelligence/editorial；日更要求 metrics；月审要求 editorial 与全部历史 media 核查。

```sh
npm run content:finalize -- --cadence=weekly --reviews=/absolute/path/reviews.json --modules=/absolute/path/modules.json
npm run github:publish -- --in-place --cadence=weekly --message 'Update verified weekly intelligence'
```

finalize 为 ready_for_build 才允许发布，回执绑定整批公开内容哈希；finalize 后内容变化必须重新核验。发布器依次检查 HEAD 内容差异、类型、业务测试、完整构建、公开源码，提交受控文件，等待本提交的 Pages 工作流成功，验证线上 manifest、全部 JSON 哈希以及应用版本，写入 `reports/<cadence>-refresh-latest.json` 与 reports/history。complete 表示内容与构建通过；publication.succeeded 才表示线上核验成功。失败回执有阶段/原因，禁止手填发布成功。没有变更不产生空提交。手动批次同样用 cadence=manual，不能绕过发布器。

继续编辑后需再次 finalize；上一批次 finalized 的旧基线不能代替新批次 begin。明确放弃当前批次用 `npm run content:abort -- --cadence=weekly`，会恢复整批 public；不要对已发布批次执行 abort。报告、基线、凭据和原始响应不在公开仓库内。

## 自动运行范围

现有指标任务：周二至周日 10:00；新增情报/影像任务：周二至周日 10:45；完整周更：周一 11:30；月审：每月 1 日 14:00，均为北京时间。四个采集/研究任务仍在本地 Codex 运行，机器必须开机且应用运行，授权也必须有效。GitHub Actions 负责内容 gate、部署及每天独立线上健康检查；它没有接管个人 MCP OAuth 或司内 DataBrain 采集。

司内常驻 runner 可以复用同一 CLI 与报告协议。需要另行配置可持续服务身份、网络权限、密钥存储、MCP/检索工具和持久化基线；在这些条件到位前，不能声称已实现云端无人值守采集。
