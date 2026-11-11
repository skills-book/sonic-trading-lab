---
name: sonic-trading-lab-setup
description: Install and start sonic-trading-lab locally using its npm launcher, explain first setup, and resolve launcher failures. Use for installation or startup requests, not strategy research or trading.
---

# sonic-trading-lab setup

Check Node.js 22+ and npm, OS and architecture. The initial npm beta supports Apple Silicon macOS only; do not claim Windows, Intel Mac or Linux support through this launcher.

Use `npx sonic-trading-lab` from the official npm package linked at https://github.com/skills-book/sonic-trading-lab. Confirm the user wants local installation before running it. For a maintainer-provided local tarball, use `npm exec --package=/absolute/path/to/package.tgz -- sonic-trading-lab`. Never invent a release URL or install an unrelated namesake.

The launcher checks updates on startup, verifies the archive SHA-256 and preserves the existing application-data directory. An already running app is reopened without replacing its engine. Quit using the dashboard's Quit app, then relaunch to update. Download failure retains the last working release. Never delete saved data to fix installation, disable Gatekeeper, or terminate an unrelated service on port 8091.

Confirm the launcher reports ready and `http://127.0.0.1:8091/api/health` responds for the intended data directory. Explain: Download historical data → New test → choose existing strategies or optional AI. Do not start downloads, paid AI calls or backtests unless requested. AI requires the user's official authenticated CLI or own API key; enter keys only into the local connection form, never chat or files.

The unsigned Mac beta may require OS approval; signing and physical clean-machine verification remain incomplete. Report errors honestly. Logs are in `~/.cache/sonic-trading-lab/launcher.log`. Existing packaged records remain in `~/Library/Application Support/StrategyLab`; this legacy storage name prevents a migration. Source-development records are separate. Historical passes are not proof of future profit and never start paper trading.
