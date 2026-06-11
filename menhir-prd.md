# Menhir — PRD (v0.3)

*A personal rebalancing agent for options-based synthetic assets.*

> Name: **Menhir** (settled) — a standing stone: holds position for millennia, unmoved by weather, and serves as a waypoint. Stone-stable with a navigational nod; sits alongside Tidal / Parallax / Polaris. First-pass collision check came back clean in crypto/DeFi; full vetting (trademark, domains, handles) still owed before public launch.
> v0.3 changes: renamed Ballast → Menhir throughout (file is now `menhir-prd.md`, probe is `menhir-probe.ts`); added the go/no-go decision framework (§8) and the standalone-salvage note (§15).

---

## 1. Thesis

Vitalik's June 2026 ethresearch post ("Building index-tracking assets on top of options instead of debt") proposes replacing debt + forced liquidation with an **options primitive**: split 1 ETH into a `(P, N)` pair at strike `S` / maturity `M`; at `M` the oracle resolves and `P = min(1, S/x)`, `N = max(0, 1 − S/x)`, so `P + N = 1` and liquidation is structurally impossible. The payoff: **no real-time oracle needed** — the only remaining action is *users rebalancing their own positions*, which the post explicitly imagines as **"a locally running agent"** that queries private oracle sources and rotates strikes.

That rebalancing agent is the product. The protocol stays dumb and safe; the intelligence lives user-side, optional, and off the trust-critical path.

**Where we sit in the post's architecture:** the design decouples two layers — the options *primitive* (the `P/N` building block) and an optional index-tracking *wrapper* on top. The post offers two modes for the wrapper: a fully-automated DAO, or "users re-balance on their own." We build tooling for the second mode. That's not a lesser version — the post argues the decoupling itself is the source of stability and flexibility, and the user-rebalances mode is where the privacy/MEV benefits live.

**Positioning:** same wedge as Parallax — be the orchestration/agent layer on top of existing primitives, not another primitive. We do not build a derivatives protocol. We build the agent that operates one.

## 2. Non-goals

- **Not** building the options primitive, the oracle, or the AMM. Existing scalar-market primitives already are the `P/N` split (§4–5).
- **Not** building the canonical "wrapper DAO" stablecoin. The post is explicit that the wrapper must be "all rules, no voting, no AI either." Our agent is deliberately the *user's personal tool*, never the canonical rebalancer.
- **Not** an accounting stablecoin. This holds *price stability* (pay known future expenses), not a 1.0000-USD peg. ~1–4%/yr quadratic drift is accepted by design.
- **Not** a social *broadcast* product. Rebalances stay private — publishing them destroys the MEV/oracle-hiding moat. A miniapp *control* surface is planned (§10); broadcasting rebalancing activity is not.

## 3. Why this wedge, why now

- The hard parts (primitive, oracle, AMM) already exist as scalar-market primitives — Seer on Gnosis, or UMA's Long-Short Pair on Base/mainnet (§4–5). The missing piece is the rebalancing intelligence — the Lucid Daydreams-shaped piece.
- The privacy property is a real moat: each user runs an independent agent with a hidden oracle set and jittered timing → MEV resistance + no global oracle to attack.
- Clean narrative: **your agent, your keys, your oracles, your timing — the protocol never has to be trusted to rebalance you.**

## 4. Chain & venue decision

The chain choice is downstream of one empirical question — *does a scalar venue with real depth already exist where the users are?* It forks on the v0 probe (§8).

| Chain | Role | Rationale |
|---|---|---|
| **Base** | **Default target** | UMA's Optimistic Oracle is live here; deploy the LSP primitive yourself — **or, now preferable, integrate a thread-builder primitive: a physically-settled P/N vault is already live on Base (mmchougule, ethresearch thread, June 2026), settling by exercise rather than oracle.** Cheap L2 rolls, Coinbase distribution, and where the agent / x402 audience already lives. Base settles to Ethereum, so you inherit L1 security lineage without L1 gas. |
| Gnosis | Fallback-if-deep | Only wins if the probe shows Seer's ETH/USD scalar markets are genuinely deep. Then you skip deploying the primitive and just build the adapter. Downside: thin user base — the original reason to look elsewhere. |
| Ethereum L1 | Credibility / large positions | Purest "trustless base asset = L1 ETH," most liquidity and credibility — but per-roll gas eats the 1–4%/yr drift budget. Reserve for large or credibility-sensitive positions, not the default operating chain. |
| Solana | Out | Primitive is EVM / scalar-market native; not where this lives. |

**Decision rule:** run the probe (§8). Seer depth real → Gnosis, plug in, skip the primitive build. Seer depth thin or absent (the likely case) → deploy UMA LSP on Base, own the primitive, take the distribution. **Either way the agent is unchanged (§5).**

**Currency-token note:** the base asset is conceptually ETH, but venues settle in a currency token (Seer: wstETH / sDAI; UMA: the LSP collateral). The ETH-denominated framing must be reconciled with the actual settlement currency — a modeling line item, not a blocker.

## 5. Venue abstraction

Every venue specific sits behind one interface, so the chain decision is a one-line swap rather than a rewrite. Taken from the probe (`menhir-probe.ts`):

```ts
interface ScalarVenue {
  name: string;
  chainId: number;
  listScalarMarkets(): Promise<ScalarMarket[]>;
  getDepth(market: ScalarMarket): Promise<DepthReport>;
}
```

- **SeerVenue (Gnosis) — implemented.** Markets via Seer's hyperindex GraphQL endpoint; depth via Swapr/Algebra pools holding the ERC20 outcome tokens. No API key needed.
- **UmaVenue (Base / mainnet) — stub.** `listScalarMarkets` reads your own deployed LSP addresses (UMA has no market index like Seer); depth via the Uniswap subgraph (needs a Graph API key). Same interface ⇒ the agent, the report, and the verdict logic are untouched.

The whole stack above this line — the LD agent (§7), cost accounting, the verdict — is venue-agnostic. Roughly the bottom 10% of the system is the only thing that changes between Seer and UMA. This is why being "torn" between them is low-stakes: it's an adapter choice, not an architecture choice.

## 6. Users

**Honest demand positioning.** The default alternative is holding USDC: zero drift, zero complexity, and (via T-bill-backed yield) positive carry. This product costs ~1–4%/yr drift plus operational complexity — **but the carry math has an income leg we initially missed: P holders are covered short puts, so they collect premium/time-value from N-side leverage demand (per Czar102 in the thread; the Liquity stability-pool analogy). Net carry = premium income − drift − slippage, which may be far better than the raw drift number.** The core users remain those who price censorship-resistance and issuer-independence — the LUSD/RAI audience, real but historically small. We ship knowing v1 serves a niche; the bull case is (a) that niche grows with issuer/regulatory risk events, (b) positive net carry if premium income holds, and (c) the same agent generalizes to any index target where no USDC-equivalent exists.

- **Primary:** crypto-native holders who want ETH-denominated price stability without a centralized issuer and without liquidation risk — comfortable running (or delegating) an agent.
- **Secondary (ecosystem):** speculators / market makers who hold the `N` side and provide roll liquidity. Not our agent users, but the system needs them. Notably, the Base/Farcaster audience is plausibly *better* at acquiring this side than the stable-holder side — and the `N` side is the harder one to bootstrap and the one tied to the existential liquidity risk (§13.1). Acquisition strategy should lean into that (§10).

## 7. The agent — Lucid Daydreams spec

**Composable contexts** (isolated workspaces with memory):

- **PositionContext** — current holdings (per option: strike `S`, maturity `M`, qty), ETH/currency balance, target exposure (e.g. "100% synthetic USD, 0% ETH"). Memory: position history, realized drift ledger.
- **OracleContext** — the user's *private* source set. Queries N independent price feeds, takes the median. Deliberately local and hidden; sources jittered per user. Memory: recent prices, per-source reliability. (x402-gated premium feeds plug in here later.)
- **MarketContext** — live venue scalar-market state (Seer or UMA — see §5): available ranges/strikes, maturities, pool depth, current option prices (the smoothed curve), implied roll cost.
- **RebalanceContext** — orchestrator; combines the above to decide and act.

**Persistent goal:** maintain target exposure within tolerance while minimizing lifetime cost (slippage + gas + drift).

**Goal loop:**
1. **Sense** — oracle median price `X`; current position delta (ETH exposure per unit, = derivative of option value); distance to strike; time to maturity.
2. **Trigger** if any: `X < S × 1.5` (price nearing strike) · `M − now < 2 weeks` (maturity buffer) · delta exposure outside tolerance band.
3. **Plan roll** — target new strike `S' < X/4` (deep in-the-money), maturity 1–2 months out; size to preserve target exposure.
4. **Execute** as a **patient one-sided maker** — place maker orders, spread the roll over a low-time-preference window, abort/adjust if slippage exceeds budget. Never market-take the whole roll at once.
5. **Reflect** — log realized cost vs. baseline; update drift ledger; adapt thresholds.

**Hard rules from the paper:**
- Never hold to maturity (avoids ETH exposure during oracle resolution).
- Deep ITM is the safe zone; roll *early*, not at the line.
- Patient MM, not instant sells (slippage is the thing that makes this uncompetitive).
- **Deliberately model-light.** The post warns against trusting a Black-Scholes-style pricer and against needing "yet another oracle" for volatility/skew/kurtosis. The agent acts on observed price-distance and delta heuristics (e.g. `X < S × 1.5`), *not* on a vol model. No vol oracle, ever. Resist the temptation to bolt on a pricer.
- Privacy: independent agents, hidden oracle sets, jittered timing.
- Agent is optional and user-side. The protocol is never trusted to rebalance.

## 8. v0 validation — the liquidity probe (the first gate)

Before any build, one script answers go/no-go: `menhir-probe.ts`. It pulls scalar markets from the venue, filters for ETH/USD-ish price markets, and sums tradeable depth (TVL + volume) in the outcome-token pools. Verdicts:

- **🟢 GREEN** — depth exists → plug into the venue (likely Gnosis/Seer), build the adapter, skip bootstrapping.
- **🟠 AMBER** — markets exist but ladder/depth thin → seed liquidity, or treat as proof-of-mechanism and ship the real venue on Base/UMA.
- **🔴 RED** — no ETH/USD scalar markets → you're bootstrapping regardless → Base/UMA for the distribution.

Thresholds (tunable, deliberately conservative): a market is "tradeable" at ≥ $5k TVL; GREEN needs ≥ 3 tradeable price markets across ≥ 2 future maturities. Honest prior: AMBER or RED is likely, since Seer's live markets skew to event/political categoricals, not ETH-price scalars. **Everything downstream waits on this result.**

**Go/no-go framework (the founder-time decision, not just the venue decision).** The structural read: Menhir's binding constraints — bootstrapping a two-sided derivatives market, a historically small demand niche (§6), regulatory weight (§13.5) — sit *outside* our lane (agent infrastructure), while the part inside our lane is deliberately simple (§13.10). Therefore the probe doubles as the commit decision:

- **GREEN** → the cheap version of this project exists: plug an agent into a live market — squarely our lane, ~2 weeks to MVP. **Go.** Proceed down §14's build-now list.
- **AMBER / RED** → proceeding means becoming a market-bootstrapping project first and an agent project second. **Default: no-go.** Walk with data, harvest the standalone pieces (§15). Override only with a conscious, written decision to take on liquidity bootstrapping as the actual job.

## 9. MVP scope

Built against the venue chosen by §4 (Seer/Gnosis or UMA/Base), through the adapter in §5.

**Build:**
1. **Read layer** — enumerate scalar markets + depth via the venue adapter (§5). Multi-ticker from the start (cheap, and strengthens the probe).
2. **Position mapping** *(the one piece of real modeling)* — translate "hold `P` at strike `S`" into the venue's representation: Seer's scalar **range** (hold the lower-bound outcome token of a market whose floor sits well below spot) or UMA's LSP bounds. Get this right and the rest is plumbing.
3. **Monitor daemon** — LD goal loop pulling oracle median + position value/exposure; computes trigger.
4. **Human-confirmed rolls** — on trigger, agent *proposes* a roll and asks the user to sign. No autonomy on day one (keeps the MVP custody-free, §11).
5. **Cost accounting** — track realized drift + slippage + gas vs. a theoretical perfect-rebalance baseline. **This is the core metric (§12).**

**Cuts for MVP:** single ticker (ETH/USD) · single venue · human-in-the-loop execution · fixed-band limit orders (no patient-MM logic yet) · no x402 monetization · single-user.

## 10. Distribution & surfaces

The surface is a Farcaster / Base miniapp, deliberately split into three:

- **Control head (private).** Connect wallet, set target ("$X of ETH-denominated stable value"), fund, view the drift ledger, and on a roll trigger: get a notification → review the proposed roll → sign. Dumb-simple; the options machinery stays hidden in the backend.
- **Agent body (backend).** The LD goal loop runs server-side, watching price + position continuously and firing triggers. The miniapp is the *head*, not the body.
- **N-side social surface (public).** A separate, loud surface for speculators who hold `N` / provide roll liquidity — casting, PnL, recruiting depth. This is where social is welcome and useful, and where Base/Farcaster's acquisition strength actually pays off.

**Privacy discipline (hard rule):** never broadcast rebalances. No auto-casts of rolls, no rebalance leaderboards — they leak timing + oracle signal and erode the moat. The stable-holder rebalances quietly; only the speculation is social.

**Why the miniapp now** (vs. "Farcaster ruled out" earlier): once Base is the default chain, miniapps are Base-native — wallet, notifications, social distribution all align with the chain. The earlier "ruled out" was about Farcaster as a *venue / broadcast layer*, which still holds. As a *control + onboarding surface on Base*, it's the natural shape, and notifications fit the human-in-the-loop roll perfectly.

## 11. Security & custody boundary

Custody is the line between "bug" and "liability."

- **No custody (MVP).** Monitor + notify + user-signs-in-app. The backend never holds keys or funds; the user signs every roll. Ship here.
- **Custody (gated).** Autonomous execution and multi-user hosting require holding or acting on user funds → threat-model before either. Keep the MVP custody-free; cross the line only after the single-user loop is proven (§14).

## 12. Metrics

- **North star:** realized all-in cost (drift + slippage + gas) vs. perfect-rebalance baseline, annualized. Target: keep total under the ~1–4%/yr the design tolerates. If we can't, the thesis is dead — fail fast here. **Report stress-period cost separately** — the average can hide tail concentration (§13.8); a clean annualized number with an ugly crash-month number is a different product than it appears.
- Rebalance success rate (rolls executed within slippage budget).
- Exposure error: time-weighted deviation from target.
- Liquidity availability: % of triggers where a suitable strike/maturity existed at acceptable depth.

## 13. Risks & open questions

1. **Liquidity (existential).** Enough depth across enough strikes/maturities to roll without blowing the drift budget? If not, we create + seed markets ourselves — turning "build an agent" into "bootstrap a market." **Validate first (§8).**
2. **Maturity ladder.** The design assumes a fresh deep-strike 1–2 month option is always available to roll into. Markets are created ad hoc; may require us to create them.
3. **Scalar ↔ strike mismatch.** Seer scalar = range payout; paper = strike option; UMA = LSP bounds. Mapping needs care and validation against real resolutions.
4. **Currency token.** Venues settle in wstETH/sDAI or LSP collateral, not raw ETH; reconcile with the ETH-denominated framing.
5. **Regulatory.** Synthetic USD + options touch securities/derivatives questions, and a consumer-facing miniapp (§10) raises the profile versus a developer tool. Get counsel before going consumer-broad — not a thing to hand-wave. (Not legal advice.)
6. **"No AI in canonical path."** Product framing must stay strictly user-side personal tooling, or it contradicts the design's own safety argument.
7. **Market-structure gap (the fidelity risk).** The post's slippage answer is partly a *market-structure* claim: near-zero user time preference argues for a venue that beats AMMs via one-sided market making. Our agent-only wedge sits on top of a vanilla AMM, so it can be a patient maker but can't change the structure. If AMM slippage alone blows the drift budget, the agent can't save it — closing the gap means touching market structure, outside current scope. The one place the post's idea is *bigger* than what we've scoped. Watch the cost baseline for it.
8. **Stress convexity.** Rolls trigger as ETH falls toward the strike — so in a sharp crash, every stable-holder's agent rolls in the same direction at the same time, exactly when N-side buyers are panicking out. No liquidation cascade (the design degrades gracefully, a real advantage over CDPs), but the drift cost concentrates in the tail: "1–4%/yr average" can hide much worse in the crash month. Mitigations: roll *early* (deep ITM buffer is precisely anti-crowding), jittered timing, and the cost ledger MUST report stress-period cost separately, not just the annualized average.
9. **Depth ≠ supply.** The probe measures *secondary* pool depth, but a roll needs a *fresh* deep-ITM option at a new strike — which requires someone to mint a new `(P,N)` pair, i.e. an N-side buyer at mint time. Secondary TVL can look healthy while fresh-strike supply is zero. The "future maturities" check partially captures this; treat mint-side supply as its own question when reading probe results.
10. **Thin algorithmic moat (acknowledged, not fixable).** The trigger logic is deliberately simple (model-light, per the post) — anyone can clone the agent with a cron job. Defensibility was never the algorithm: it's distribution (miniapp/Base), the verified cost ledger (which becomes the ERC-8183 evaluator criterion), and ecosystem position (LD rails, the lucid-8183 adapter). Do not let pitch or pricing imply the IP is the rebalancing rule.

## 14. Roadmap

Organized around *what gates each thing*, not engineering sequence. Agentic engineering makes writing code cheap; it does nothing for liquidity, strategy calibration, validation, custody risk, or regulatory exposure. So: build everything whose only cost was code now; gate everything whose cost is non-code behind the thing that retires that cost.

**v0 — the gate:** run the liquidity probe (§8). It decides the venue and whether you're plugging in or bootstrapping. Nothing else starts until this returns.

**Build now (cheap to write, low non-code cost):**
- Read layer + **multi-ticker** from the start (free, and strengthens the probe).
- Position-mapping model (scalar-range / LSP-bounds ↔ strike).
- Monitor daemon (LD goal loop) + human-confirmed rolls.
- **Rich cost-accounting / drift ledger** — as deep as possible now; it's the instrument everything is judged by.
- **Patient-MM backtester** (offline only) — reason about the maker strategy before live flow. Output is *hypotheses*, never tuned params.
- Miniapp control head (set target, fund, notify, sign) — custody-free (§11).

**Gated on validation (cheap to write, expensive to get wrong):**

| Feature | Gate that unlocks it |
|---|---|
| Live patient one-sided MM | Real order flow to calibrate against (backtester ≠ live counterparties) |
| Autonomous execution (no human sign) | Cost baseline proves trigger + slippage model are right on real rolls |
| Multi-user agent hosting | A proven single-user loop *and* a threat-modeled custody/key model |
| "Wrapper" stablecoin abstraction | Regulatory read + proven loop; must stay non-canonical (no-AI constraint) |
| x402-gated premium oracle feeds | A working free-feed oracle median first; monetization is last |
| N-side social surface at scale | A working two-sided market worth recruiting liquidity into |

**Hosted-milestone settlement rail (ERC-8183 + ERC-8004) — captured for later, not pulled forward.** When multi-user hosting unlocks, rebalancing-as-a-service settles as *epochal jobs* on ERC-8183 (Agentic Commerce, draft Feb 2026): each billing period is one job — the user funds the period's fee into escrow, the operator agent rebalances through the period, then `submit`s a commitment to the period's drift/slippage ledger; an **evaluator smart contract** reads our on-chain cost ledger (§12) against the SLA and `complete`s (fee releases) or `reject`s (refund). Job expiry refunds the user if the operator disappears. ERC-8004 supplies operator identity + reputation, so completed/rejected jobs compound into *verified* track record — enabling a marketplace of competing rebalancing agents ranked by outcome rather than marketing. This converts "trust the operator" into "verify the outcome," and the core metric we're building anyway (§12) doubles as the completion criterion.

**Lucid Daydreams' role here:** LD covers most of the plumbing — the runtime (§7) plus its native x402 / A2A / ERC-8004 rails handle payment facilitation, agent discovery, and reputation registration. What we'd build is small: the evaluator contract (a reader of our own ledger) and a thin ERC-8183 adapter for LD. No such adapter exists yet given how new the draft is — shipping a `lucid-8183` module is itself strategic positioning in the agentic-commerce ecosystem, independent of Menhir.

The discipline isn't "build slowly." It's "don't let unvalidated logic touch real funds, and don't take on custody/regulatory surface before the core thesis is proven."

## 15. Ecosystem watch (the thread, June 2026)

Vitalik's follow-up confirmed multiple teams are building versions of the primitive, with a formal-verification call for anything heading to mainnet. State of play and what it changes:

- **mmchougule (Base)** — physically-settled P/N vault, live, settlement-by-exercise (no settlement oracle for on-chain pairs). His stated open questions — secondary liquidity formation, minimal-slippage rolling, reliable exercise without re-introducing an oracle — *are this PRD*. He calls his keeper prototype "execution infrastructure, not a protocol guarantee." **Menhir is that infrastructure. Primary integration candidate and go-to-market: engage in-thread.**
- **SIR (Xatarrer)** — live perpetual liquidity-backed variant (no expiry, no rolling). Different construction; a *competitor to the need for rolling*, worth tracking as substitute risk.
- **blueprints.finance (Czar102)** — "sound options," oraclelessness, risk tranching. Two takeaways folded in: (a) his short-dated predictable-rolling argument (3–4 day maturities, roll at 1 day, strike ~60% of spot, gradual-auction execution at ~0.10%/yr cost) is both a challenge to "dynamic rebalancing" and a *strategy mode the agent should support* — the gradual auction IS our patient one-sided maker; (b) it reconfirms §13.10: the moat is execution quality + verified ledger, never decision cleverness.
- **Strategic shift:** the original no-go logic assumed *we'd* have to bootstrap the market. The thread is bootstrapping it. The agent layer is conspicuously unbuilt and explicitly asked-for. **This materially upgrades the go case: if a thread primitive reaches usable state on Base, the GREEN path (§8) exists without Seer.** Add a `ThreadVaultVenue` adapter behind the §5 interface when mmchougule's (or similar) contracts stabilize.
- **Vitalik's "robustness-optimized oracles" nudge** — points directly at OracleContext (hidden multi-source median). Potential standalone module alongside lucid-8183.

## 16. Standalone salvage (survives a no-go)

Two artifacts from this work have value independent of Menhir shipping:

- **`lucid-8183` adapter** — a thin Lucid Daydreams integration for ERC-8183 (escrow/evaluator settlement). Small, squarely in-lane, no integrations exist for the three-month-old standard, and it positions LD in the agentic-commerce settlement story regardless of any single product. **Build this either way.**
- **The pattern itself** — venue abstraction + probe-gated validation + custody boundary + gated roadmap is a reusable template for any "agent operating a DeFi primitive" project. Keep `menhir-prd.md` as the reference even if Menhir is shelved.

---

### Open decisions
- ~~Name~~ → **Menhir** (settled; full trademark/domain/handle vetting owed before public launch).
- **Venue** → decided by the v0 probe (§8): Gnosis/Seer if deep, else Base/UMA.
- **Hosted vs. local agent** for v1 — the paper favors local (privacy); hosted ships faster. Hybrid (local oracle + timing, hosted heavy lifting)?
- **Consumer reach** — how broad to take the miniapp before the regulatory read (§13.5) is back.
