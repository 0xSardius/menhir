# Menhir — Checkpoint

## Current state (2026-06-12)

**Both gates have returned: probe = 🔴 RED on Seer/Gnosis, and the §15 override research found no live alternative venue.** The GREEN path (plug an agent into an existing venue, ~2 weeks to MVP) does not exist today on any chain. Recommendation on record (below): conditional pause on venue-dependent Menhir work, proceed with in-lane salvage (§16), set a revisit trigger on SplitVault. Awaiting the user's written go/no-go decision per §8.

## §15 override research — 2026-06-12 (web research, verified claims)

Question: does a thread primitive make the GREEN path exist without Seer? **Answer: no, not yet.**

- **mmchougule's SplitVault (Base)** — real but embryonic. Verified contract at `0xb1E5f96C7B1eB5792c0a5E659E8917147195f7e1` (deployed 2026-06-05, source verified, Solidity 0.8.24). Lifetime activity: **5 transactions in ~5 minutes** on deploy day (mint → exercise → settle → redeem P → claim USDC) — a scripted lifecycle test. **$0 TVL, no token holdings, no secondary liquidity.** Proof-of-concept, not a venue. It is 7 days old and presumably active — the strongest "revisit later" candidate.
- **SIR (Xatarrer)** — live (relaunched after a March 2025 exploit that drained its full ~$355k TVL) but on mainnet/HyperEVM/MegaETH, **not Base**; perpetual with no strike/maturity structure, so nothing to roll. Substitute-risk tracker, not a venue.
- **blueprints.finance (Czar102)** — pre-product. Framework marketing site; no contracts, chains, TVL, audits, or any mention of "sound options."
- **UMA LSP on Base** — the `LongShortPairCreator` factory is deployed on Base at `0x0fDF0fa7FEA145c6c141BCa763c0D4c2e906b3e1` (UMA official manifest), so deploy-your-own remains possible — but no ETH/USD LSPs with depth exist. (Deeper UMA verification was cut short; factory address should be re-confirmed on Basescan before any use.)

## Recommendation (2026-06-12)

Per §8 the RED default is no-go, and the §15 override condition ("a thread primitive reaches usable state on Base") is **not met**. Recommendation — not a project kill, a conditional pause:

1. **Do not start the §14 build-now list.** Every current path requires bootstrapping a two-sided market first — the exact failure mode §8 warns against.
2. **Build the §16 salvage that's in-lane either way:** the `lucid-8183` adapter ("build this either way" per PRD).
3. **Set a revisit trigger, not a date:** SplitVault (or similar) showing real third-party usage — non-deployer mints, nonzero TVL, a secondary pool. Engaging mmchougule in-thread is cheap and doubles as go-to-market (§15 already names him the primary integration candidate).
4. Any decision to override and bootstrap liquidity ourselves must be a conscious written one per §8.

**Decision status: DECIDED 2026-06-12 (founder, in session).** Conditional pause on venue-dependent Menhir work accepted. Miniapp cut entirely. Build `lucid-8183` now (§16). Reach out to mmchougule (SplitVault) under the assumption the primitive will mature — outreach draft to be prepared. Revisit trigger unchanged (SplitVault third-party usage / TVL / secondary pool).

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

## lucid-8183 build status (2026-06-12)

Verified-spec foundation: ERC-8183 interface/events/errors transcribed from the reference implementation (github.com/erc-8183/base-contracts, MIT); extension typed against the real `@lucid-agents/types` `Extension` interface (compile-time contract).

- ✅ **Step 0 — spec spike.** ERC-8183 is real (eips.ethereum.org/EIPS/eip-8183; Open→Funded→Submitted→Completed/Rejected/Expired; evaluator-only complete/reject; claimRefund after expiry; optional IERC8183Hook). SDK = `@lucid-agents/core@2.5.0` + `@lucid-agents/types@1.7.0` (daydreamsai/lucid-agents).
- ✅ **Step 1 — `Erc8183Client`** (`packages/lucid-8183/src/client.ts`): typed viem client, simulate-first writes, jobId from receipt logs, ERC-20 allowance handling, settlement watcher. Tests green.
- ✅ **Step 2 (reordered) — `erc8183()` extension** (`src/extension.ts`): Lucid Agents runtime slice — createAndFundJob / submitWork / commitmentOf / watchSettlement / claimExpiredRefund. Tests green (9 total).
- ⬜ **IEvaluator + reference evaluator (Solidity + Foundry).** Blocked locally: Foundry not installed on this machine. Note: we only need the *evaluator*, not the escrow — the ERC8183 reference contract already exists.
- ⬜ **Base Sepolia e2e demo.** Needs: a deployed ERC-8183 escrow on Base Sepolia (check whether a canonical deployment exists first — none was listed in the repo docs; we may need to deploy the reference impl ourselves), funded testnet wallet (keys via `.env`, never committed/echoed).
- 📄 **Outreach draft to mmchougule:** `docs/outreach-mmchougule.md` — ready for user review/posting; verify his exact thread wording before quoting.

## Next actions

1. Install Foundry; write `IEvaluator` + reference evaluator + tests (ethskills for Solidity).
2. Find or deploy an ERC-8183 escrow on Base Sepolia; run the e2e demo.
3. User: review/post the mmchougule outreach draft.
4. Revisit Menhir's venue build when the trigger fires (SplitVault third-party usage / TVL / secondary pool).

## Session log

- **2026-06-11:** Repo initialized, CLAUDE.md written, pushed to https://github.com/0xSardius/menhir.git. Liquidity probe run for the first time → RED on Seer/Gnosis. Checkpoint created.
- **2026-06-12:** §15 override research completed (SplitVault embryonic/$0 TVL, SIR not-Base/no maturities, blueprints pre-product, UMA LSP factory on Base but no live ETH/USD pairs). Recommendation recorded: conditional pause + §16 salvage + SplitVault revisit trigger. Decision open.
