import { keccak256, toBytes, type Address, type TransactionReceipt } from "viem";
import type { Extension } from "@lucid-agents/types/core";
import { Erc8183Client } from "./client.js";
import type { Bytes32, CreateJobParams, Erc8183ClientConfig } from "./types.js";

export interface CreateAndFundJobParams extends CreateJobParams {
  /** ERC-20 payment token for the escrow (must be allowlisted on the contract). */
  token: Address;
  /** Escrow amount in the token's smallest unit. */
  amount: bigint;
}

/**
 * The runtime slice this extension contributes at `runtime.erc8183`.
 * Thin role-based helpers over Erc8183Client; the client itself is exposed
 * for anything not covered.
 */
export interface Erc8183Runtime {
  client: Erc8183Client;

  /** Client role: create, budget, and fund a job in one call. Returns the jobId. */
  createAndFundJob(params: CreateAndFundJobParams): Promise<bigint>;

  /** Provider role: submit the work commitment for a funded job. */
  submitWork(jobId: bigint, deliverable: Bytes32): Promise<TransactionReceipt>;

  /** Any role: hash arbitrary deliverable bytes/text into a bytes32 commitment. */
  commitmentOf(data: string | Uint8Array): Bytes32;

  /** Any role: resolve a job's settlement (completed/rejected/expired); returns unwatch. */
  watchSettlement(
    jobId: bigint,
    onSettled: (outcome: "completed" | "rejected" | "expired") => void,
  ): () => void;

  /** Any role: trigger the refund for a job past its expiry. */
  claimExpiredRefund(jobId: bigint): Promise<TransactionReceipt>;
}

export type Erc8183ExtensionConfig = Erc8183ClientConfig;

export function createErc8183Runtime(config: Erc8183ExtensionConfig): Erc8183Runtime {
  const client = new Erc8183Client(config);
  return {
    client,

    async createAndFundJob(params) {
      const { token, amount, ...createParams } = params;
      const { jobId } = await client.createJob(createParams);
      await client.setBudget(jobId, token, amount);
      await client.fund(jobId, amount);
      return jobId;
    },

    submitWork: (jobId, deliverable) => client.submit(jobId, deliverable),

    commitmentOf: (data) => keccak256(typeof data === "string" ? toBytes(data) : data),

    watchSettlement: (jobId, onSettled) => client.watchSettlement(jobId, onSettled),

    claimExpiredRefund: (jobId) => client.claimRefund(jobId),
  };
}

/**
 * ERC-8183 (Agentic Commerce) extension for the Lucid Agents SDK.
 *
 * @example
 * const agent = await createAgent({ name: "operator" })
 *   .use(erc8183({ address, publicClient, walletClient }))
 *   .build();
 * await agent.erc8183.submitWork(jobId, agent.erc8183.commitmentOf(ledgerJson));
 */
export function erc8183(config: Erc8183ExtensionConfig): Extension<{ erc8183: Erc8183Runtime }> {
  return {
    name: "erc8183",
    build: () => ({ erc8183: createErc8183Runtime(config) }),
  };
}
