# sonic-trading-lab — unsigned Mac beta

Local AI-assisted crypto strategy research and historical backtesting. No durable trading edge has been established. Historical passes are not forecasts or trading approval.

## Install and start

Apple Silicon Mac and Node.js 22+ required:

```sh
npx sonic-trading-lab
```

The small npm launcher downloads the bundled application, verifies its checksum and opens http://127.0.0.1:8091. No separate Python or Docker. On first use choose **Download historical data**, then **New test**. Data covers five Binance spot pairs from September 2024 through December 2025, including warm-up; no 2026 downloads. Allow at least 1GB for the app and initial data.

**Unsigned development beta:** tested on the maintainer's Apple Silicon Mac, not a fresh physical Mac. macOS may block it. The launcher does not bypass security controls. Windows, Intel Mac and Linux are not supported by this npm beta. Node26/npm11 were exercised; Node22 is the declared minimum, not separately tested.

## Updates and saved work

Each start checks the official release manifest, independently of npm caching. A running instance is reopened without updating its engine. Use **Quit app**, then run the command again for updates. Closing the browser does not quit the application. Failed downloads/checksums fall back to the last working version. Downgrades are refused. Old application bundles are retained.

Each test has an independent wallet. Saved candles, logs and SQLite remain in `~/Library/Application Support/StrategyLab` (legacy storage name retained to preserve data). Bundles/logs are cached at `~/.cache/sonic-trading-lab`. The launcher does not change a separate paper bot. A different service/data directory on port8091 produces a conflict rather than being stopped.

## Optional AI and setup skill

Install and authenticate Codex or Claude Code using their official tools, or supply your own OpenAI/Anthropic API key in the local dashboard. AI needs internet and provider allowance. Keys stay in backend memory. The packaged worker was checked with fixtures; live provider cycles in the packaged app remain unverified. Existing-strategy backtests do not require AI.

One setup skill is included at [skills/sonic-trading-lab-setup](skills/sonic-trading-lab-setup). Copy that folder into your agent's skills directory: `~/.codex/skills/` for Codex or `~/.claude/skills/` for Claude Code. It explains setup and does not automatically start paid research or backtests.

## Research limits

All provided history is reused research data. Results include the existing 0.10% fee and0.02% adverse slippage per side plus the daily funding assumption. Minute candles do not reproduce order books or partial fills; shorts use spot prices as a proxy. Green means the five displayed historical checks passed, not ready to trade. Searching many variations can select luck.

## Release maintenance

The manifest at `releases/latest.json` points to versioned GitHub Release ZIPs and SHA256 hashes. Upload the new asset before updating that file; never replace an existing version with different contents. Build a new application for engine/UI changes and preserve data compatibility. HTTPS hosting is the manifest trust authority; hashes detect corruption, not compromise of the publishing account. Signing/notarization remains unfinished.

The launcher is dependency-free Node.js. `npm pack` produces the npm package. `SONIC_LAB_RELEASE_URL`, `SONIC_LAB_CACHE`, `STRATEGY_LAB_HOME`, `STRATEGY_LAB_PORT`, and `SONIC_LAB_NO_BROWSER=1` are optional maintainer verification overrides, not required for normal use. No auto-update of a running engine or automatic database migration is performed.
