# Automated Dashboard Refresh Design

The daily and weekly jobs share the same atomic lock. Each job fetches DataBrain metric batches into a temporary directory, builds public JSON from that staging area, validates coverage and dates, and runs the appropriate verification. Only a successful run copies raw artifacts into the retained `outputs` and `bi_data` directories.

The daily path uses 42 days so 30-day aggregates can be recomputed even when DataBrain corrects recent rows. It invokes the snapshot builder in metrics-only mode, leaving 90-day charts, events, and anomaly attribution fixed until the weekly run.

The weekly path uses 104 fetched days and emits the latest valid 90-day window. It then refreshes events and anomaly attribution and runs the full test suite.

Publishing remains outside the data scripts because OpenAI Sites is exposed through a Codex connector rather than a shell API. Scheduled Codex tasks run the data command, publish the exact validated Git revision through Sites, wait for a successful deployment status, and then call the report recorder. A failed publication does not replace the current production deployment.

Run reports are machine-readable JSON under `reports/`. They distinguish data completion from publication and include source coverage before and after each run.
