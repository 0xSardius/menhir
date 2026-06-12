import { describe, expect, it } from "vitest";
import { keccak256, toBytes, zeroAddress } from "viem";
import type { Extension } from "@lucid-agents/types/core";
import { erc8183, type Erc8183Runtime } from "../src/extension.js";

const dummyConfig = {
  address: "0x0000000000000000000000000000000000000001",
  publicClient: {} as never,
} as const;

describe("erc8183 extension", () => {
  it("satisfies the Lucid Agents Extension contract", () => {
    // Type-level check: assignment fails to compile if the shape drifts.
    const ext: Extension<{ erc8183: Erc8183Runtime }> = erc8183(dummyConfig);
    expect(ext.name).toBe("erc8183");
    expect(typeof ext.build).toBe("function");
  });

  it("build() contributes the erc8183 runtime slice", () => {
    const ext = erc8183(dummyConfig);
    const slice = ext.build({ meta: { name: "t", version: "0" } as never, runtime: {} });
    expect(slice.erc8183).toBeDefined();
    expect(slice.erc8183.client.address).toBe(dummyConfig.address);
    expect(typeof slice.erc8183.createAndFundJob).toBe("function");
    expect(typeof slice.erc8183.submitWork).toBe("function");
  });

  it("commitmentOf hashes strings and bytes consistently", () => {
    const ext = erc8183(dummyConfig);
    const { commitmentOf } = ext.build({ meta: {} as never, runtime: {} }).erc8183;
    const ledger = JSON.stringify({ period: 1, driftBps: 12, slippageBps: 3 });
    expect(commitmentOf(ledger)).toBe(keccak256(toBytes(ledger)));
    expect(commitmentOf(toBytes(ledger))).toBe(commitmentOf(ledger));
    expect(commitmentOf(ledger)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("runtime config never requires a wallet for read-only use", () => {
    // No walletClient in dummyConfig — constructing the runtime must not throw.
    expect(() => erc8183({ ...dummyConfig, walletClient: undefined })).not.toThrow();
    expect(zeroAddress).toBeDefined();
  });
});
