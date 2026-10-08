# Implementation Plan

- [x] 1. Define daily and weekly cadence boundaries
  - Keep daily snapshots separate from weekly charts and research.
  - _Requirements: 1, 2_

- [x] 2. Add safe refresh orchestration
  - Add a shared lock, staged raw artifacts, rollback, and reports.
  - _Requirements: 1, 2, 3_

- [x] 3. Add publication reporting
  - Record Sites version, deployment, URL, and deployment health.
  - _Requirement: 4_

- [x] 4. Verify both refresh paths
  - Test date windows, coverage guardrails, lock behavior, build, and the full suite.
  - _Requirements: 1, 2, 3_

- [x] 5. Schedule the jobs
  - Create a daily metric task and a weekly full-refresh task in local project context.
  - _Requirements: 4, 5_
