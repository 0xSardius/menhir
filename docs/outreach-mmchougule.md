# Outreach draft — mmchougule (SplitVault, ethresearch thread)

*Draft for the user to post/adapt in Vitalik's "index-tracking assets on options" thread or as a DM. Written 2026-06-12. Tone: builder-to-builder, specific, no pitch-deck energy.*

---

Hey — I've been working through the same design space from the other end: the user-side rebalancing agent the original post hand-waves as "a locally running agent."

I saw your SplitVault deploy on Base (the verified contract at `0xb1E5...f7e1`) and ran through the lifecycle test you did on deploy day. Your three open questions — secondary liquidity formation, minimal-slippage rolling, reliable exercise without re-introducing an oracle — are exactly the layer I've been speccing, and you called your keeper prototype "execution infrastructure, not a protocol guarantee." That infrastructure is the whole of what I'm building: a venue-agnostic agent (private multi-source oracle median, deep-ITM roll triggers, patient one-sided execution, and a verifiable per-period cost ledger) that deliberately stays off the trust-critical path.

Two things I'd value your read on:

1. **Mint-side supply at roll time.** A roll needs a fresh deep-ITM strike, which needs an N-side buyer at mint. How are you thinking about bootstrapping that side? My read is secondary TVL can look fine while fresh-strike supply is zero, and that's the binding constraint on any rolling design.
2. **Adapter surface.** My agent sits behind a small venue interface (`listScalarMarkets` / `getDepth` and a position-mapping layer). When SplitVault's interfaces stabilize, I'd like to write the adapter against it. Is the current contract shape (mint → exercise → settle → redeem) settled, or still moving?

Not trying to sell anything — the agent layer only works if a primitive like yours gets liquidity, so our incentives point the same direction. Happy to share the probe/cost-ledger tooling I've built so far if useful.

---

*Notes for the user before posting:*
- *Verify his current handle/thread activity — this draft assumes the June thread is still live.*
- *The "three open questions" phrasing paraphrases his post as summarized in our PRD (§15) — re-check his exact wording before quoting.*
- *Decide whether to link the GitHub repo (it would expose the PRD's full strategy, including the no-go framework). Suggest linking only the probe script or keeping it private until after first contact.*
