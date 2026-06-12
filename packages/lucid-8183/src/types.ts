import type {
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  Transport,
  WalletClient,
} from "viem";

/** Mirrors the on-chain JobStatus enum (ERC-8183 reference implementation). */
export enum JobStatus {
  Open = 0,
  Funded = 1,
  Submitted = 2,
  Completed = 3,
  Rejected = 4,
  Expired = 5,
}

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set([
  JobStatus.Completed,
  JobStatus.Rejected,
  JobStatus.Expired,
]);

/** Decoded Job struct, with the uint8 status lifted to the enum. */
export interface Job {
  jobId: bigint;
  client: Address;
  status: JobStatus;
  provider: Address;
  expiredAt: number;
  evaluator: Address;
  submittedAt: number;
  budget: bigint;
  hook: Address;
  paymentToken: Address;
  providerAgentId: bigint;
  description: string;
}

export interface CreateJobParams {
  provider: Address;
  evaluator: Address;
  /** Unix seconds. Must satisfy the contract's minimum-expiry check. */
  expiredAt: number;
  description: string;
  /** Optional ERC-8183 hook; zero address = no hook. */
  hook?: Address;
  /** Optional ERC-8004 agent id of the provider; 0 = none. */
  providerAgentId?: bigint;
}

/** Wallet client with a hoisted account, required for writes. */
export type WriteClient = WalletClient<Transport, Chain | undefined, Account>;

export interface Erc8183ClientConfig {
  /** Deployed ERC-8183 escrow contract. */
  address: Address;
  publicClient: PublicClient;
  /** Required for writes; reads work without it. */
  walletClient?: WriteClient;
}

export type Bytes32 = Hex;
