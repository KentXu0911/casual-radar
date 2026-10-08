# Automated Dashboard Refresh Requirements

## Scope

The dashboard uses two update frequencies because source metrics arrive daily while research conclusions are reviewed weekly.

## Requirements

1. Daily metric refresh
   - When the daily job runs, the system shall re-fetch the latest 42 calendar days and update only the current mobile and PC metric snapshot.
   - When source dates are missing, the system shall preserve the source rows as returned and shall not interpolate values.
   - When a source correction arrives for a recent date, the system shall replace the affected aggregate with the re-fetched value.

2. Weekly full refresh
   - When the weekly job runs, the system shall fetch 104 calendar days and publish the latest valid 90-day trend window.
   - When trends change, the system shall refresh product events and rebuild anomaly attributions against the same weekly window.

3. Safety
   - While one refresh is active, when another refresh starts, the second run shall stop before changing data.
   - When fetching, validation, building, or testing fails, the system shall restore the last good public snapshot.
   - Before a run succeeds, the system shall keep newly fetched raw artifacts isolated from the last good artifacts.

4. Publication
   - When all checks pass, the scheduled task shall publish the exact validated source revision to the bound OpenAI Site.
   - When publication succeeds, the system shall record the version, deployment, URL, and health-check time in the run report.
   - When publication fails, the system shall keep the last successful deployment online and record the failure.

5. Scheduling
   - The system shall run the metric refresh daily after the prior day's data settlement window.
   - The system shall run the full refresh weekly after the daily task and shall not overlap it.

## Non-goals

- Daily jobs do not change research copy, lifecycle classification, category assignment, events, trend charts, or anomaly attribution.
- Automatic discovery of new games remains an editorial review step.
