# lucid-8183

ERC-8183 (Agentic Commerce) adapter for the [Lucid Agents SDK](https://github.com/daydreamsai/lucid-agents) — escrowed jobs, evaluator settlement, expiry refunds.

[ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) defines a three-party job escrow: a **client** funds a job, a **provider** (your agent) submits a work commitment, and an **evaluator** — alone — completes (escrow → provider) or rejects (refund → client). If nobody acts before the deadline, anyone can trigger an expiry refund. This converts "trust the operator" into "verify the outcome."

This package gives a Lucid agent that lifecycle as a runtime slice, alongside the SDK's existing x402 / ERC-8004 / A2A rails.

## Install

```sh
npm install lucid-8183 viem
```

## Use as a Lucid Agents extension

```ts
import { createAgent } from "@lucid-agents/core";
import { erc8183 } from "lucid-8183";

const agent = await createAgent({ name: "operator", version: "1.0.0" })
  .use(erc8183({ address: ERC8183_CONTRACT, publicClient, walletClient }))
  .build();

// Provider role: commit to the period's work ledger and submit
const commitment = agent.erc8183.commitmentOf(JSON.stringify(periodLedger));
await agent.erc8183.submitWork(jobId, commitment);

// Watch for the evaluator's verdict
agent.erc8183.watchSettlement(jobId, (outcome) => {
  console.log(`job ${jobId}: ${outcome}`); // completed | rejected | expired
});
```

Client role (the party paying for work):

```ts
const jobId = await agent.erc8183.createAndFundJob({
  provider: operatorAddress,
  evaluator: evaluatorContract,
  expiredAt: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  description: "Rebalancing service, July billing period",
  token: USDC,
  amount: 50_000_000n, // 50 USDC
});
```

## Use the client standalone (no agent runtime)

```ts
import { Erc8183Client } from "lucid-8183";

const client = new Erc8183Client({ address, publicClient, walletClient });
const job = await client.getJob(1n);            // typed Job with JobStatus enum
await client.fund(1n, job.budget);              // handles ERC-20 allowance
await client.claimRefund(1n);                   // after expiry
```

All writes simulate first and wait for the receipt. Reads work without a `walletClient`.

## What this package is not

It does not implement an evaluator. ERC-8183 leaves evaluation open — an EOA, a committee, or (the interesting case) a smart contract that reads on-chain evidence and settles mechanically. A reference `IEvaluator` implementation is planned.

## Provenance

ABI transcribed from the ERC-8183 reference implementation ([erc-8183/base-contracts](https://github.com/erc-8183/base-contracts), MIT). Extension contract typed against `@lucid-agents/types` — if the SDK's `Extension` interface changes, this package fails to compile rather than failing at runtime.

MIT.
