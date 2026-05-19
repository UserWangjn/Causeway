# Jobs

This folder is reserved for BullMQ processors or scheduled jobs.

Initial job boundaries:

- `polymarket-market-sync` (implemented as a default-disabled scheduler in `modules/polymarket-sync`, guarded by the `SchedulerLock` table)
- `polymarket-price-refresh`
- `inference-run`
- `order-status-refresh`
- `portfolio-refresh`
- `script-monitor`
