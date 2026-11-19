# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mift2609/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mift2609/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a sealed DefiLlama snapshot of 758 protocols. It ranks 200 pre-token protocols — all 40 watchlist names plus the 160 largest below the $50M TVL floor — by an implied launch value derived from the snapshot's own market evidence: for each category, the trimmed-median market-cap/TVL ratio of its live, token-bearing protocols (outliers dropped, thin categories shrunk toward the global median), multiplied by the protocol's TVL and adjusted for 7-day growth, listing age and chain spread. Every factor, the category's peer count and the global ratio are written into each row's model breakdown, so any value can be recomputed from the snapshot alone. Each ranked protocol carries a concrete farm playbook for its category (7–8 steps with capital tiers and per-chain gas estimates), and the 24 largest token-bearing protocols are listed separately, never ranked. The dashboard is fully static and offline: a sortable board, text search, category filter, pre-token/live tabs and a per-protocol detail drawer with the full model breakdown and farm steps. Deterministic: no clock, no randomness, no network — two runs write identical bytes.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
