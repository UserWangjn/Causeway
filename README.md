# Causeway / PM

This repository is the new development workspace for Causeway.

## Current Contents

- `docs/causeway/`: Causeway product, frontend, backend, API, database, AI inference, Polymarket integration, roadmap, and real-order spike documents.
- `docs/prototypes/`: frontend prototype images.

## Development Notes

The order and portfolio APIs are designed to support both `dry_run` and `real` execution modes. Real Polymarket CLOB trading and wallet balance reads can be connected incrementally while keeping the frontend/backend protocol stable.
