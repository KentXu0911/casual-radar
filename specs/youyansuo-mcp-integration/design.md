# 游研所 MCP 接入设计

## 目标

把游研所作为产品情报源接入每周完整更新，同时保持 DataBrain 的量化指标职责不变。MCP 扫描先生成候选与动态快照，只有已跟踪产品的唯一匹配动态可以自动进入产品资料；新品候选不自动晋级主追踪池。

## 数据流

```text
Codex 周更任务调用 youyansuo 只读工具
        |
        v
outputs/youyansuo/raw/<run-id>.json
        |
        v
scripts/normalize-youyansuo-discovery.mjs
        |
        +--> public/youyansuo_discovery.json  (候选、身份、证据、状态)
        +--> public/youyansuo_discovery.json  (候选与已跟踪动态独立快照)
```

MCP 原始响应只保存在 `outputs/`，不进入网页资源。网页只读取规范化快照，展示来源 URL、日期、身份状态和人工状态。

## 规范化记录

每条候选记录包含：`name`、`aliases`、`category`、`platform`、`developer`、`publisher`、`event_type`、`event_date`、`evidence_title`、`source_url`、`identity_status`、`disposition` 和 `metrics_status`。默认 `disposition` 为 `待人工核验`，默认 `metrics_status` 为 `未接入 DataBrain`。

已跟踪产品的动态沿用现有产品实体和别名映射，文章只有发布日期时写成报道/研究，不自动转成发生事件。冲突名称、无来源 URL、无日期或无法唯一匹配的内容只保留在候选快照。

## 运行与回滚

- 周更在 DataBrain 之后执行 MCP 规范化，并共享 `.automation/refresh.lock`。
- MCP 阶段支持 `--input` 读取 Codex MCP 任务生成的原始/规范化 JSON，方便本地重放和测试。
- 周更保护 `youyansuo_discovery.json`、`databrain_research.json`、`games.json` 和 `dashboard_data.json`；任意后续校验失败时恢复。
- `internal_only`、401、OAuth 过期、429、超时和部分批次写入报告的 `youyansuo.status`，不当作空结果。
- 没有 MCP 输入时，周更可以明确标记 `skipped` 或 `blocked`，不能伪造成功扫描。

## 看板展示

品类总览增加“新品发现与开发动态”区域，展示最近候选、类型、平台、报道日期、身份状态和来源。它与主产品排行、在研项目矩阵分开，不产生 DAU/ACU/收入数值；本阶段不自动合并到 `databrain_research.json` 或 `dashboard_data.json`。

## 测试策略

- 规范化测试：匹配、去重、日期、独立产品/玩法误判、缺失指标和授权错误。
- 工作流测试：MCP 快照写入受保护清单，失败恢复旧快照。
- 页面测试：候选显示为“待核验/观察”，不显示为已上线或在研产品。
- 完整测试继续使用现有 `npm test`，不要求 Cloudflare 类型检查作为本次验收条件。
