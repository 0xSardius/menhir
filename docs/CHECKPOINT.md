# Menhir — Checkpoint

## Current state (2026-06-11)

**v0 liquidity probe has been run. Verdict: 🔴 RED.** The PRD's gate (§8) has returned; the project is now at the go/no-go decision point, which is a founder call (§8 explicitly). Awaiting the user's written decision before any §14 build-now work starts.

## Probe results — 2026-06-11, venue: Seer (Gnosis, chain 100)

Command: `npx tsx menhir-probe.ts` (ran clean, no endpoint drift, no fixes needed).

- Scalar markets found: **367**
- ETH/USD-ish price markets (name heuristic): **0**
- Fallback probe of the 10 largest scalar markets by supply: all are "Which percentile score will Clément assign to <movie>?" novelty markets, all maturity 2026-05-21 (already past), all **$0 TVL / $0 volume** across their Swapr pools.
- Tradeable price markets (TVL ≥ $5k): **0** · distinct future maturities: **0**

**Reading:** this is a strong RED, not a borderline one. Seer has no ETH/USD scalar markets at all, and even its largest scalar markets have zero secondary depth. The §13.9 caveat (secondary TVL ≠ mint-side supply) cuts the same direction — there is no mint-side activity either. The PRD's honest prior ("AMBER or RED is likely, since Seer's live markets skew to event/political categoricals") is confirmed, and then some.

## Decision framework now in play (PRD §8 + §15)

- **PRD §8 default on RED: no-go.** Proceeding means becoming a market-bootstrapping project first, agent project second. Walk with data; harvest standalone pieces (§16: `lucid-8183` adapter, the reusable pattern).
- **§15 override question (open):** the ethresearch thread is bootstrapping the market — if mmchougule's physically-settled P/N vault on Base (or a similar thread primitive) is live and usable, the GREEN path exists without Seer. This requires web research into the current state of those contracts. Per §8, overriding the no-go default requires a conscious, written decision.

## Next actions

1. (Optional, recommended before deciding) Research the current state of mmchougule's Base P/N vault and other thread primitives (§15) — is there a usable venue to plug into?
2. User makes the written go/no-go call.
3. If go → §14 build-now list, starting with the read layer (multi-ticker) and a `ThreadVaultVenue`/`UmaVenue` adapter behind the §5 interface. If no-go → build `lucid-8183` standalone (§16, "build this either way").

## Session log

- **2026-06-11:** Repo initialized, CLAUDE.md written, pushed to https://github.com/0xSardius/menhir.git. Liquidity probe run for the first time → RED on Seer/Gnosis. Checkpoint created.
