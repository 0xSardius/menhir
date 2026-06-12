import {
  erc20Abi,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { erc8183Abi } from "./abi.js";
import {
  JobStatus,
  TERMINAL_STATUSES,
  type Bytes32,
  type CreateJobParams,
  type Erc8183ClientConfig,
  type Job,
} from "./types.js";

const EMPTY_BYTES = "0x" as const;

/**
 * Thin typed client for an ERC-8183 escrow contract.
 *
 * Role-agnostic: a client (buyer) uses createJob/setBudget/fund/claimRefund,
 * a provider (agent) uses submit, an evaluator uses complete/reject.
 * All writes simulate first and wait for the receipt.
 */
export class Erc8183Client {
  readonly address: Address;
  private readonly pub: Erc8183ClientConfig["publicClient"];
  private readonly wallet?: Erc8183ClientConfig["walletClient"];

  constructor(cfg: Erc8183ClientConfig) {
    this.address = cfg.address;
    this.pub = cfg.publicClient;
    this.wallet = cfg.walletClient;
  }

  // ------------------------------------------------------------------ reads

  async getJob(jobId: bigint): Promise<Job> {
    const j = await this.pub.readContract({
      address: this.address,
      abi: erc8183Abi,
      functionName: "getJob",
      args: [jobId],
    });
    return {
      jobId,
      client: j.client,
      status: j.status as JobStatus,
      provider: j.provider,
      expiredAt: Number(j.expiredAt),
      evaluator: j.evaluator,
      submittedAt: Number(j.submittedAt),
      budget: j.budget,
      hook: j.hook,
      paymentToken: j.paymentToken,
      providerAgentId: j.providerAgentId,
      description: j.description,
    };
  }

  async isTerminal(jobId: bigint): Promise<boolean> {
    return TERMINAL_STATUSES.has((await this.getJob(jobId)).status);
  }

  // ----------------------------------------------------------------- writes

  /** Create a job; returns the new jobId decoded from the JobCreated event. */
  async createJob(params: CreateJobParams): Promise<{ jobId: bigint; receipt: TransactionReceipt }> {
    const receipt = await this.write("createJob", [
      params.provider,
      params.evaluator,
      params.expiredAt,
      params.description,
      params.hook ?? zeroAddress,
      params.providerAgentId ?? 0n,
    ]);
    const [created] = parseEventLogs({
      abi: erc8183Abi,
      eventName: "JobCreated",
      logs: receipt.logs,
    });
    if (!created) throw new Error("JobCreated event not found in receipt");
    return { jobId: created.args.jobId, receipt };
  }

  async setProvider(jobId: bigint, provider: Address, agentId = 0n): Promise<TransactionReceipt> {
    return this.write("setProvider", [jobId, provider, agentId]);
  }

  async setBudget(
    jobId: bigint,
    token: Address,
    amount: bigint,
    optParams: Bytes32 | `0x${string}` = EMPTY_BYTES,
  ): Promise<TransactionReceipt> {
    return this.write("setBudget", [jobId, token, amount, optParams]);
  }

  /**
   * Fund the escrow. The contract pulls `expectedBudget` of the payment token,
   * so the client wallet must have approved it; `ensureAllowance` handles that.
   */
  async fund(
    jobId: bigint,
    expectedBudget: bigint,
    opts: { ensureAllowance?: boolean; optParams?: `0x${string}` } = {},
  ): Promise<TransactionReceipt> {
    if (opts.ensureAllowance ?? true) {
      const { paymentToken } = await this.getJob(jobId);
      await this.ensureAllowance(paymentToken, expectedBudget);
    }
    return this.write("fund", [jobId, expectedBudget, opts.optParams ?? EMPTY_BYTES]);
  }

  /** Provider submits the work commitment (e.g. a hash of the deliverable/ledger). */
  async submit(
    jobId: bigint,
    deliverable: Bytes32,
    optParams: `0x${string}` = EMPTY_BYTES,
  ): Promise<TransactionReceipt> {
    return this.write("submit", [jobId, deliverable, optParams]);
  }

  /** Evaluator-only: release escrow to the provider. */
  async complete(
    jobId: bigint,
    reason: Bytes32,
    optParams: `0x${string}` = EMPTY_BYTES,
  ): Promise<TransactionReceipt> {
    return this.write("complete", [jobId, reason, optParams]);
  }

  /** Evaluator-only: refund the client. */
  async reject(
    jobId: bigint,
    reason: Bytes32,
    optParams: `0x${string}` = EMPTY_BYTES,
  ): Promise<TransactionReceipt> {
    return this.write("reject", [jobId, reason, optParams]);
  }

  /** After expiry anyone may trigger the refund to the client. */
  async claimRefund(jobId: bigint): Promise<TransactionReceipt> {
    return this.write("claimRefund", [jobId]);
  }

  // ----------------------------------------------------------------- events

  /**
   * Watch a job until it reaches a terminal state. Returns an unwatch fn.
   * Fires on Completed / Rejected / Expired events for the given jobId.
   */
  watchSettlement(
    jobId: bigint,
    onSettled: (outcome: "completed" | "rejected" | "expired") => void,
  ): () => void {
    const unwatch = this.pub.watchContractEvent({
      address: this.address,
      abi: erc8183Abi,
      onLogs: (logs: unknown) => {
        const parsed = parseEventLogs({
          abi: erc8183Abi,
          logs: logs as never,
          eventName: ["JobCompleted", "JobRejected", "JobExpired"],
        });
        for (const log of parsed) {
          if (log.args.jobId !== jobId) continue;
          unwatch();
          onSettled(
            log.eventName === "JobCompleted"
              ? "completed"
              : log.eventName === "JobRejected"
                ? "rejected"
                : "expired",
          );
          return;
        }
      },
    });
    return unwatch;
  }

  // ---------------------------------------------------------------- helpers

  /** Approve the escrow contract to pull `amount` of `token` if allowance is short. */
  async ensureAllowance(token: Address, amount: bigint): Promise<Hash | null> {
    const wallet = this.requireWallet();
    const owner = wallet.account.address;
    const current = await this.pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, this.address],
    });
    if (current >= amount) return null;
    const { request } = await this.pub.simulateContract({
      account: wallet.account,
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.address, amount],
    });
    const hash = await wallet.writeContract(request);
    await this.pub.waitForTransactionReceipt({ hash });
    return hash;
  }

  private requireWallet() {
    if (!this.wallet) throw new Error("Erc8183Client: walletClient required for writes");
    return this.wallet;
  }

  private async write(
    functionName:
      | "createJob"
      | "setProvider"
      | "setBudget"
      | "fund"
      | "submit"
      | "complete"
      | "reject"
      | "claimRefund",
    args: readonly unknown[],
  ): Promise<TransactionReceipt> {
    const wallet = this.requireWallet();
    const { request } = await this.pub.simulateContract({
      account: wallet.account,
      address: this.address,
      abi: erc8183Abi,
      functionName,
      args: args as never,
    });
    const hash = await wallet.writeContract(request as never);
    return this.pub.waitForTransactionReceipt({ hash });
  }
}
