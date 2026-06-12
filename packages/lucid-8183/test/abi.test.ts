import { describe, expect, it } from "vitest";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
  zeroAddress,
} from "viem";
import { erc8183Abi } from "../src/abi.js";
import { JobStatus, TERMINAL_STATUSES } from "../src/types.js";

describe("erc8183Abi", () => {
  it("contains the full user-facing lifecycle surface", () => {
    for (const name of [
      "createJob",
      "setProvider",
      "setBudget",
      "fund",
      "submit",
      "complete",
      "reject",
      "claimRefund",
      "getJob",
    ] as const) {
      expect(getAbiItem({ abi: erc8183Abi, name }), name).toBeDefined();
    }
  });

  it("round-trips a JobCreated event log (indexed topics + data)", () => {
    const topics = encodeEventTopics({
      abi: erc8183Abi,
      eventName: "JobCreated",
      args: {
        jobId: 42n,
        client: "0x1111111111111111111111111111111111111111",
        provider: "0x2222222222222222222222222222222222222222",
      },
    });
    // non-indexed params, in declaration order: evaluator, expiredAt, hook
    const data = encodeAbiParameters(
      [{ type: "address" }, { type: "uint48" }, { type: "address" }],
      ["0x3333333333333333333333333333333333333333", 1765000000n, zeroAddress],
    );
    const decoded = decodeEventLog({ abi: erc8183Abi, topics, data });
    expect(decoded.eventName).toBe("JobCreated");
    expect(decoded.args).toMatchObject({
      jobId: 42n,
      client: "0x1111111111111111111111111111111111111111",
      evaluator: "0x3333333333333333333333333333333333333333",
      expiredAt: 1765000000,
      hook: zeroAddress,
    });
  });

  it("round-trips a JobCompleted event log", () => {
    const reason = `0x${"00".repeat(31)}01` as const;
    const topics = encodeEventTopics({
      abi: erc8183Abi,
      eventName: "JobCompleted",
      args: { jobId: 7n, evaluator: "0x3333333333333333333333333333333333333333" },
    });
    const data = encodeAbiParameters([{ type: "bytes32" }], [reason]);
    const decoded = decodeEventLog({ abi: erc8183Abi, topics, data });
    expect(decoded.eventName).toBe("JobCompleted");
    expect(decoded.args).toMatchObject({ jobId: 7n, reason });
  });
});

describe("JobStatus", () => {
  it("matches the on-chain enum ordering (Open..Expired = 0..5)", () => {
    expect(JobStatus.Open).toBe(0);
    expect(JobStatus.Funded).toBe(1);
    expect(JobStatus.Submitted).toBe(2);
    expect(JobStatus.Completed).toBe(3);
    expect(JobStatus.Rejected).toBe(4);
    expect(JobStatus.Expired).toBe(5);
  });

  it("treats exactly Completed/Rejected/Expired as terminal", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual([
      JobStatus.Completed,
      JobStatus.Rejected,
      JobStatus.Expired,
    ]);
    expect(TERMINAL_STATUSES.has(JobStatus.Funded)).toBe(false);
  });
});
