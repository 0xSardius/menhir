#!/usr/bin/env -S npx tsx
/**
 * Menhir — v0 liquidity probe
 * --------------------------------------------------------------------------
 * Question this answers: do options-style scalar markets for ETH/USD (or any
 * price index) exist with enough tradeable depth to roll a position cheaply?
 * That single question is the go/no-go for the whole thesis (PRD §9.1).
 *
 * It also doubles as first contact with Seer's real interface.
 *
 * Design: everything is behind a `ScalarVenue` interface. Seer (Gnosis) is
 * implemented now. UMA (Base/mainnet) is a stub with notes — swapping venues
 * is a one-line change in main(). No part of the report logic is Seer-specific.
 *
 * Endpoints + schema are taken verbatim from Seer's open-source SDK
 * (github.com/seer-pm/demo, packages/seer-pm-sdk). The Gnosis path needs no
 * API key. Run:  npx tsx menhir-probe.ts   (or: bun menhir-probe.ts)
 */

// ----------------------------------------------------------------------------
// Types (venue-agnostic)
// ----------------------------------------------------------------------------

const CHAINS = { gnosis: 100, mainnet: 1, base: 8453 } as const;

interface ScalarMarket {
  venue: string;
  chainId: number;
  address: string;
  name: string;
  lowerBound: number;
  upperBound: number;
  openingTs: number; // resolution / maturity (unix seconds)
  collateralToken: string;
  outcomeTokens: string[]; // ERC20 (wrapped) outcome token addresses, lowercased
  outcomesSupply: number; // total collateral split into the market (a size proxy)
}

interface PoolDepth {
  id: string;
  pair: string;
  tvlUSD: number;
  volUSD: number;
}

interface DepthReport {
  market: ScalarMarket;
  pools: PoolDepth[];
  totalTvlUSD: number;
  totalVolUSD: number;
}

interface ScalarVenue {
  name: string;
  chainId: number;
  listScalarMarkets(): Promise<ScalarMarket[]>;
  getDepth(market: ScalarMarket): Promise<DepthReport>;
}

// ----------------------------------------------------------------------------
// Tiny GraphQL helper (native fetch, no deps)
// ----------------------------------------------------------------------------

async function gql<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("GraphQL returned no data");
  return json.data;
}

const lc = (s: string) => s.toLowerCase();
const num = (s: string | number | null | undefined) => (s == null ? 0 : Number(s));

// ----------------------------------------------------------------------------
// Seer venue (Gnosis) — implemented
// ----------------------------------------------------------------------------

class SeerVenue implements ScalarVenue {
  name = "seer";
  chainId = CHAINS.gnosis;

  // From seer-pm-sdk/src/subgraph/subgraph-endpoints.ts
  private MARKETS = "https://indexer.hyperindex.xyz/798eb82/v1/graphql";
  private SWAPR =
    "https://api.goldsky.com/api/public/project_cmair7jgkzena01x58241cqow/subgraphs/swapr-algebra/3.0.0/gn";

  async listScalarMarkets(): Promise<ScalarMarket[]> {
    // Hasura-style API. Pull this chain's markets, classify scalar in code by
    // a real range (upperBound != lowerBound) so we don't depend on the exact
    // marketType enum string.
    const query = /* GraphQL */ `
      query GetMarkets($where: Market_bool_exp, $limit: Int!) {
        Market(where: $where, limit: $limit, order_by: { blockTimestamp: desc }) {
          address
          chainId
          marketType
          marketName
          wrappedTokens
          collateralToken
          lowerBound
          upperBound
          openingTs
          outcomesSupply
        }
      }
    `;
    type Row = {
      address: string;
      chainId: number;
      marketType: string | null;
      marketName: string;
      wrappedTokens: string[] | null;
      collateralToken: string | null;
      lowerBound: string | number | null;
      upperBound: string | number | null;
      openingTs: string | number | null;
      outcomesSupply: string | number | null;
    };
    const data = await gql<{ Market: Row[] }>(this.MARKETS, query, {
      where: { chainId: { _eq: this.chainId } },
      limit: 2000,
    });

    return data.Market.filter((m) => {
      const lo = num(m.lowerBound);
      const hi = num(m.upperBound);
      const looksScalar = hi > lo || /scalar/i.test(m.marketType ?? "");
      return looksScalar;
    }).map((m) => ({
      venue: this.name,
      chainId: m.chainId,
      address: lc(m.address),
      name: m.marketName,
      lowerBound: num(m.lowerBound),
      upperBound: num(m.upperBound),
      openingTs: num(m.openingTs),
      collateralToken: lc(m.collateralToken ?? ""),
      outcomeTokens: (m.wrappedTokens ?? []).map(lc),
      outcomesSupply: num(m.outcomesSupply),
    }));
  }

  async getDepth(market: ScalarMarket): Promise<DepthReport> {
    // Outcome tokens trade as ERC20 on Swapr (Algebra) pools. Find pools that
    // hold any of this market's outcome tokens; sum TVL + volume.
    const query = /* GraphQL */ `
      query GetPools($tokens: [String!]) {
        a: pools(first: 100, where: { token0_in: $tokens }) { ...P }
        b: pools(first: 100, where: { token1_in: $tokens }) { ...P }
      }
      fragment P on Pool {
        id
        totalValueLockedUSD
        volumeUSD
        token0 { id symbol }
        token1 { id symbol }
      }
    `;
    type P = {
      id: string;
      totalValueLockedUSD: string | null;
      volumeUSD: string | null;
      token0: { id: string; symbol: string };
      token1: { id: string; symbol: string };
    };
    let pools: PoolDepth[] = [];
    try {
      const data = await gql<{ a: P[]; b: P[] }>(this.SWAPR, query, {
        tokens: market.outcomeTokens,
      });
      const seen = new Set<string>();
      pools = [...data.a, ...data.b]
        .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
        .map((p) => ({
          id: p.id,
          pair: `${p.token0.symbol}/${p.token1.symbol}`,
          tvlUSD: num(p.totalValueLockedUSD),
          volUSD: num(p.volumeUSD),
        }));
    } catch (e) {
      console.warn(`  ! depth query failed for ${market.address}: ${(e as Error).message}`);
    }
    return {
      market,
      pools,
      totalTvlUSD: pools.reduce((s, p) => s + p.tvlUSD, 0),
      totalVolUSD: pools.reduce((s, p) => s + p.volUSD, 0),
    };
  }
}

// ----------------------------------------------------------------------------
// UMA venue (Base / mainnet) — STUB for later
// ----------------------------------------------------------------------------
//
// To implement when/if we take the Base path:
//  - Markets: UMA's Long-Short Pair has no "market list" index like Seer. You
//    either enumerate LSP deployments you created, or read a registry. So
//    listScalarMarkets() = read your own deployed LSPs (via viem + a config of
//    addresses), mapping (collateral, lowerBound/upperBound from the FPL,
//    expirationTimestamp) -> ScalarMarket.
//  - Depth: long/short tokens are ERC20; query the Uniswap v3 subgraph on Base
//    (gateway.thegraph.com, id HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1)
//    by token address. THIS path needs a Graph API key (env GRAPH_API_KEY).
//  - Everything below (report, go/no-go) is unchanged.
class UmaVenue implements ScalarVenue {
  name = "uma";
  chainId = CHAINS.base;
  async listScalarMarkets(): Promise<ScalarMarket[]> {
    throw new Error("UmaVenue not implemented yet — see notes above the class.");
  }
  async getDepth(_market: ScalarMarket): Promise<DepthReport> {
    throw new Error("UmaVenue not implemented yet.");
  }
}

// ----------------------------------------------------------------------------
// ETH/USD-ish heuristic + reporting (venue-agnostic)
// ----------------------------------------------------------------------------

function looksLikePriceMarket(name: string): boolean {
  const n = name.toLowerCase();
  const isEth = /\b(eth|ether|ethereum)\b/.test(n);
  const isPrice = /(price|\$|usd|usdc|usdt|dollar|trade at|reach|above|below)/.test(n);
  return isEth && isPrice;
}

const fmtUSD = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
const fmtDate = (ts: number) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "—");

// Tunable go/no-go thresholds — deliberately conservative. Adjust as you learn.
const MIN_TVL_PER_MARKET = 5_000; // a market is "tradeable" above this
const MIN_TRADEABLE_MARKETS = 3; // need a few live to roll across maturities
const MIN_FUTURE_MATURITIES = 2; // need a ladder to roll into

async function main() {
  // -------- swap the venue here when UMA is ready --------
  const venue: ScalarVenue = new SeerVenue();
  // const venue: ScalarVenue = new UmaVenue();
  // -------------------------------------------------------

  console.log(`\n=== Menhir liquidity probe — venue: ${venue.name} (chain ${venue.chainId}) ===\n`);

  const all = await venue.listScalarMarkets();
  console.log(`Scalar markets found: ${all.length}`);

  const priceMarkets = all.filter((m) => looksLikePriceMarket(m.name));
  console.log(`ETH/USD-ish price markets (name heuristic): ${priceMarkets.length}`);

  // Probe depth for the price markets; if none match the heuristic, fall back to
  // the highest-supply scalar markets so we still learn what depth looks like.
  const probeSet =
    priceMarkets.length > 0
      ? priceMarkets
      : [...all].sort((a, b) => b.outcomesSupply - a.outcomesSupply).slice(0, 10);
  if (priceMarkets.length === 0) {
    console.log(
      `(no ETH/USD price markets matched — probing the ${probeSet.length} largest scalar markets instead)`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const reports: DepthReport[] = [];
  for (const m of probeSet) {
    const r = await venue.getDepth(m);
    reports.push(r);
    const future = m.openingTs > now ? " (future)" : "";
    console.log(
      `\n• ${m.name.slice(0, 70)}\n  range [${m.lowerBound}, ${m.upperBound}]  maturity ${fmtDate(m.openingTs)}${future}` +
        `\n  TVL ${fmtUSD(r.totalTvlUSD)}  vol ${fmtUSD(r.totalVolUSD)}  pools ${r.pools.length}  supply ${m.outcomesSupply.toFixed(2)}`,
    );
  }

  // -------- verdict --------
  const tradeable = reports.filter((r) => r.totalTvlUSD >= MIN_TVL_PER_MARKET);
  const futureMaturities = new Set(
    tradeable.filter((r) => r.market.openingTs > now).map((r) => fmtDate(r.market.openingTs)),
  );
  const green =
    priceMarkets.length > 0 &&
    tradeable.length >= MIN_TRADEABLE_MARKETS &&
    futureMaturities.size >= MIN_FUTURE_MATURITIES;

  console.log(`\n=== VERDICT ===`);
  console.log(`tradeable price markets (TVL >= ${fmtUSD(MIN_TVL_PER_MARKET)}): ${tradeable.length}`);
  console.log(`distinct future maturities among them: ${futureMaturities.size}`);
  if (green) {
    console.log(`\n✅ GREEN — depth exists. Plug into ${venue.name}; build the adapter, skip bootstrapping.`);
  } else if (priceMarkets.length === 0) {
    console.log(
      `\n🔴 RED — no ETH/USD scalar markets on ${venue.name}. You'd be creating + seeding the market yourself.` +
        `\n   This is the data point that argues for the Base/UMA path (distribution where you bootstrap anyway).`,
    );
  } else {
    console.log(
      `\n🟠 AMBER — price markets exist but depth/ladder is thin. Either seed liquidity, or treat ${venue.name}` +
        `\n   as proof-of-mechanism and ship the real venue on Base/UMA.`,
    );
  }
  console.log("");
}

main().catch((e) => {
  console.error("\nProbe failed:", (e as Error).message);
  process.exit(1);
});
