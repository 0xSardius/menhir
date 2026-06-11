# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Menhir is a personal rebalancing agent for options-based synthetic assets (based on Vitalik's June 2026 ethresearch post on index-tracking assets built on options instead of debt). The product is the *agent layer only* — it operates existing scalar-market primitives (Seer on Gnosis, UMA LSP on Base) and deliberately does not build a protocol, oracle, or AMM.

`menhir-prd.md` is the source of truth for scope, constraints, and sequencing. Read it before making product or architecture decisions — section references below (§) point into it.

## Commands

There is no package.json; the probe is a zero-dependency script using native fetch.

```
npx tsx menhir-probe.ts    # or: bun menhir-probe.ts
```

No build, lint, or test setup exists yet. The Gnosis/Seer path needs no API key; the UMA/Base path (stubbed) will need `GRAPH_API_KEY` for the Uniswap subgraph.

## Architecture

**Everything is gated on the liquidity probe (`menhir-probe.ts`).** It answers the go/no-go question (PRD §8): do ETH/USD scalar markets exist with enough depth to roll positions cheaply? GREEN → build the adapter and proceed; AMBER/RED → default no-go (the project would become market-bootstrapping, not agent-building). Nothing downstream of the probe should be built until it returns. Verdict thresholds are the tunable constants near the top of the report section (`MIN_TVL_PER_MARKET`, etc.).

**Venue abstraction is the load-bearing seam.** All venue specifics sit behind the `ScalarVenue` interface (`listScalarMarkets()` / `getDepth()`). `SeerVenue` (Gnosis, hyperindex GraphQL + Swapr/Algebra pools) is implemented; `UmaVenue` (Base) is a stub with implementation notes in comments. Swapping venues is a one-line change in `main()`. Everything above the interface — report logic, verdict, the future agent — must stay venue-agnostic. A `ThreadVaultVenue` adapter (for the Base P/N vault from the ethresearch thread, §15) is a planned third implementation.

**The planned agent** (§7) is a Lucid Daydreams goal loop with four contexts: Position, Oracle (private multi-source median), Market (via the venue adapter), and Rebalance (orchestrator). MVP is human-in-the-loop: the agent proposes rolls, the user signs.

## Hard constraints (from the PRD — do not violate)

- **Model-light by design.** Trigger logic uses observed price-distance and delta heuristics (e.g. `X < S × 1.5`). Never add a Black-Scholes-style pricer or a volatility oracle (§7).
- **Custody-free MVP.** The backend never holds keys or funds; users sign every roll. Autonomous execution and multi-user hosting are gated behind validation milestones (§11, §14).
- **Privacy discipline.** Never broadcast rebalances (no auto-casts, no rebalance leaderboards) — timing/oracle leakage destroys the MEV-resistance moat (§10).
- **Stay non-canonical.** The agent is the user's personal tool, never the protocol's canonical rebalancer ("no AI in the trust-critical path," §2, §13.6).
- **Gated roadmap.** Build only what costs code; anything with non-code cost (live MM, autonomy, custody, regulatory surface) waits on its gate in the §14 table.

## Working rules

- Use the **ethskills** skills for any Ethereum development work (contracts, addresses, L2s, wallets, testing, etc.).
- Never reveal `.env` values in chat — reference variable names only.
- Commit and push after each modular feature. Remote: https://github.com/0xSardius/menhir.git
