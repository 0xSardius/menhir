import { parseAbi } from "viem";

/**
 * ERC-8183 (Agentic Commerce) ABI — user-facing surface only (admin/upgrade
 * functions omitted). Transcribed verbatim from the reference implementation
 * at github.com/erc-8183/base-contracts (contracts/ERC8183.sol, MIT).
 *
 * Job struct field order matters for getJob decoding — do not reorder.
 */
export const erc8183Abi = parseAbi([
  // --- lifecycle ---
  "function createJob(address provider, address evaluator, uint48 expiredAt, string description, address hook, uint256 providerAgentId) returns (uint256)",
  "function setProvider(uint256 jobId, address provider_, uint256 agentId)",
  "function setBudget(uint256 jobId, address token, uint256 amount, bytes optParams)",
  "function fund(uint256 jobId, uint256 expectedBudget, bytes optParams)",
  "function submit(uint256 jobId, bytes32 deliverable, bytes optParams)",
  "function complete(uint256 jobId, bytes32 reason, bytes optParams)",
  "function reject(uint256 jobId, bytes32 reason, bytes optParams)",
  "function claimRefund(uint256 jobId)",

  // --- views ---
  "function getJob(uint256 jobId) view returns ((address client, uint8 status, address provider, uint48 expiredAt, address evaluator, uint48 submittedAt, uint256 budget, address hook, address paymentToken, uint256 providerAgentId, string description))",

  // --- events ---
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint48 expiredAt, address hook)",
  "event ProviderSet(uint256 indexed jobId, address indexed provider, uint256 agentId)",
  "event BudgetSet(uint256 indexed jobId, address indexed token, uint256 amount)",
  "event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount)",
  "event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable)",
  "event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason)",
  "event JobRejected(uint256 indexed jobId, address indexed rejector, bytes32 reason)",
  "event JobExpired(uint256 indexed jobId)",
  "event PaymentReleased(uint256 indexed jobId, address indexed provider, uint256 amount)",
  "event PlatformFeePaid(uint256 indexed jobId, address indexed platformTreasury, uint256 amount)",
  "event EvaluatorFeePaid(uint256 indexed jobId, address indexed evaluator, uint256 amount)",
  "event Refunded(uint256 indexed jobId, address indexed client, uint256 amount)",

  // --- errors ---
  "error InvalidJob()",
  "error InvalidHook()",
  "error WrongStatus()",
  "error Unauthorized()",
  "error ZeroAddress()",
  "error ExpiryTooShort()",
  "error ProviderNotSet()",
  "error FeesTooHigh()",
  "error HookNotWhitelisted()",
  "error BudgetMismatch()",
  "error ProviderCannotBeEvaluator()",
  "error ClientCannotBeProvider()",
  "error GracePeriodActive()",
  "error PaymentTokenNotAllowed()",
  "error UnexpectedFundedAmount()",
]);
