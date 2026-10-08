# Implementation Plan

- [x] 1. 建立 MCP 规范化快照与错误状态
  - 读取授权 MCP 任务生成的 JSON 输入。
  - 规范化候选、身份状态、来源、日期和指标缺失状态。
  - _Requirements: R1, R2, R4, R5, R7_

- [x] 2. 接入每周受控刷新
  - 在周更中增加 MCP 阶段、保护快照并写入报告。
  - 保证缺少输入、授权失败和部分批次不会污染正式数据。
  - _Requirements: R6, R7, R8_

- [x] 3. 接入 Codex MCP 扫描任务提示
  - 要求任务调用文章、产品身份和动态工具。
  - 要求将只读结果保存到指定 `outputs/youyansuo/raw/` 路径。
  - _Requirements: R1, R3, R7_

- [x] 4. 增加新品雷达展示
  - 读取规范化快照并展示候选、来源和人工状态。
  - 保持候选与主产品排行、在研矩阵分离。
  - _Requirements: R2, R9_

- [x] 5. 安全门禁与回归测试
  - 增加脏工作区检查、MCP 错误分类、回滚和页面回归测试。
  - 运行构建与完整测试。
  - _Requirements: R6, R7, R8, R10_
