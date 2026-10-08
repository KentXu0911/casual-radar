The existing JSON feeds remain compatible, with stable product_id and milestone_id fields. A derived product-catalog.json provides a common identity index. Editorial decisions and reviewed media are separate, persistent records.

Each run captures a baseline before mutation. The finalizer creates a milestone diff, applies supplied verified reviews, validates historical preservation and cross-view consistency, then writes module outcomes and content-health.json. New or changed reveal/test records with unresolved searches block publishing. Historical unresolved records enter the monthly queue.

Builds generate a content-addressed release-manifest.json. Every static resource belongs to the same manifest version; CI binds that version to the deployed commit. The publication verifier checks GitHub's actual Pages run and live file hashes, then creates one local receipt for manual and scheduled runs.

Local authenticated MCP and browser research run through the scheduled agent. GitHub handles reproducible validation, static deployment and a scheduled health check. A company runner can execute the same CLI; transferring personal OAuth sessions is not part of deployment.
