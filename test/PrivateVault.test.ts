import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { before, describe, it, beforeEach } from "node:test";
import { nox } from "@iexec-nox/nox-hardhat-plugin";
import { getContract } from "viem";

const require = createRequire(import.meta.url);

// Canonical NoxCompute address etched by the plugin's local Nox stack.
const NOX_COMPUTE_ADDRESS = "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685" as `0x${string}`;

// Hardhat v3 exposes the viem API under `connection.viem`. Attach the
// convenience accessors (`deployContract`, `walletClient`, `viem.test`) that
// this suite was written against, so calls stay concise and consistent.
// Each call is assigned a distinct account (first call -> account[0], second
// call -> account[1], ...) so tests that pit two parties against each other get
// genuinely different senders. `beforeEach` resets the counter so every test's
// first connection is always account[0], the account the plugin's
// encryptInput/decrypt helpers are bound to.
let connectionAccountIndex = 0;
async function makeConnection() {
  const connection = await nox.connect();
  const viem = connection.viem as any;
  if (!(connection as any).deployContract) {
    (connection as any).deployContract = (...args: any[]) => viem.deployContract(...args);
  }
  if (!(connection as any).walletClient) {
    const walletClients = await viem.getWalletClients();
    (connection as any).walletClient =
      walletClients[connectionAccountIndex % walletClients.length];
    connectionAccountIndex++;
  }
  if (!viem.test) {
    viem.test = await viem.getTestClient();
  }
  return connection;
}

// Solidity flattens `mapping(...) public` struct getters into separate return
// values, which viem decodes as a plain array. Normalize it back to the named
// object shape this suite was written against.
async function readWithdrawalRequest(vault: any, requestId: bigint) {
  const raw = await vault.read.withdrawalRequests([requestId]);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    const r = raw as readonly unknown[];
    return { amount: r[0], owner: r[1], deadline: r[2], finalized: r[3] };
  }
  return raw;
}

// Retry wrappers for off-chain handle resolution. Poll the handle gateway's
// cheap `/v0/public/handles/status` endpoint (the same one the plugin uses
// internally) before invoking the heavier `publicDecrypt`/`decrypt`, so a
// not-yet-computed handle is retried gently instead of flooding the gateway.
function handleGatewayStatusUrl() {
  const port = process.env.NOX_HANDLE_GATEWAY_HOST_PORT;
  if (port === undefined || port === "") {
    throw new Error("NOX_HANDLE_GATEWAY_HOST_PORT not set; is the Nox stack started?");
  }
  return `http://127.0.0.1:${port}/v0/public/handles/status`;
}

async function waitForHandlesResolved(
  handles: string[],
  attempts = 180,
  delayMs = 1000
) {
  const url = handleGatewayStatusUrl();
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          payload?: { statuses?: Array<{ handle: string; resolved: boolean }> };
        };
        const resolvedByHandle = new Map(
          (data.payload?.statuses ?? []).map((s) => [
            s.handle.toLowerCase(),
            s.resolved,
          ])
        );
        if (handles.every((h) => resolvedByHandle.get(h.toLowerCase()) === true)) {
          return;
        }
      }
    } catch {
      // gateway not ready yet; retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Handles not resolved after retries: ${handles.join(", ")}`);
}

async function waitForPublicDecrypt(
  handle: `0x${string}`,
  attempts = 180,
  delayMs = 1000
) {
  await waitForHandlesResolved([handle], attempts, delayMs);
  const res = await nox.publicDecrypt(handle);
  if (res && res.value !== undefined) return res;
  throw new Error(`publicDecrypt returned no value for handle ${handle}`);
}

async function waitForDecrypt(
  handle: `0x${string}`,
  attempts = 180,
  delayMs = 1000
) {
  await waitForHandlesResolved([handle], attempts, delayMs);
  const res = await nox.decrypt(handle);
  if (res && res.value !== undefined) return res;
  throw new Error(`decrypt returned no value for handle ${handle}`);
}

// The Nox proof-expiration default is 1h (NoxCompute constructor). The suite's
// time-travel tests advance the chain clock by days, which would make every
// proof created afterwards look expired (block.timestamp > createdAt + 1h).
// Extend the window once via the admin/upgrader account so those tests pass.
async function extendProofExpiration(connection: any) {
  const artifact = require(
    "@iexec-nox/nox-protocol-contracts/artifacts/contracts/NoxCompute.sol/NoxCompute.json"
  );
  const publicClient = await connection.viem.getPublicClient();
  const compute = getContract({
    address: NOX_COMPUTE_ADDRESS,
    abi: artifact.abi,
    client: { public: publicClient, wallet: connection.walletClient },
  }) as any;
  const THIRTY_DAYS = 30n * 24n * 60n * 60n;
  const current = (await compute.read.proofExpirationDuration()) as bigint;
  if (current < THIRTY_DAYS) {
    await compute.write.setProofExpirationDuration([THIRTY_DAYS]);
  }
}

describe("PrivateVault", () => {
  before(async () => {
    connectionAccountIndex = 0;
    await extendProofExpiration(await makeConnection());
  });

  beforeEach(() => {
    connectionAccountIndex = 0;
  });

  it("deploys and initializes with zero confidential total deposits", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const handle = (await vault.read.confidentialTotalDeposited()) as `0x${string}`;
    const { value } = await waitForPublicDecrypt(handle);
    assert.equal(value, 0n);
  });

  it("accepts an encrypted deposit and mints confidential shares", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n;

    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle, handleProof } = await nox.encryptInput(
      depositAmount,
      "uint256",
      vault.address
    );

    await vault.write.deposit([depositAmount, handle, handleProof]);

    const totalDepositedHandle =
      (await vault.read.confidentialTotalDeposited()) as `0x${string}`;
    const { value: totalDeposited } = await waitForPublicDecrypt(
      totalDepositedHandle
    );
    assert.equal(totalDeposited, depositAmount);
  });

  it("allows user to decrypt their own confidential balance", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 500n;
    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle, handleProof } = await nox.encryptInput(
      depositAmount,
      "uint256",
      vault.address
    );
    await vault.write.deposit([depositAmount, handle, handleProof]);

    const balanceHandle = (await vault.read.confidentialBalanceOf([
      connection.walletClient.account.address,
    ])) as `0x${string}`;

    const { value: balance } = await waitForDecrypt(balanceHandle);
    assert.equal(balance, depositAmount);
  });

  it("processes a two-step withdrawal: request + finalize", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 2000n;
    const withdrawAmount = 800n;

    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depositHandle, handleProof: depositProof } =
      await nox.encryptInput(depositAmount, "uint256", vault.address);
    await vault.write.deposit([depositAmount, depositHandle, depositProof]);

    const { handle: withdrawHandle, handleProof: withdrawProof } =
      await nox.encryptInput(withdrawAmount, "uint256", vault.address);
    await vault.write.requestWithdraw([withdrawHandle, withdrawProof]);

    const requestId = await vault.read.withdrawalCount();
    const request = await readWithdrawalRequest(vault, requestId);

    assert.equal(request.finalized, false);

    const { value: decryptedAmount, decryptionProof } = await waitForPublicDecrypt(
      request.amount as `0x${string}`
    );
    assert.equal(decryptedAmount, withdrawAmount);

    await vault.write.finalizeWithdraw([
      requestId,
      decryptedAmount,
      decryptionProof,
    ]);

    const finalizedRequest = await readWithdrawalRequest(vault, requestId);
    assert.equal(finalizedRequest.finalized, true);

    const vaultBalance = await mockToken.read.balanceOf([vault.address]);
    assert.equal(vaultBalance, depositAmount - withdrawAmount);
  });

  it("reverts on double-finalize of the same withdrawal request", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n;
    const withdrawAmount = 400n;

    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depositHandle, handleProof: depositProof } =
      await nox.encryptInput(depositAmount, "uint256", vault.address);
    await vault.write.deposit([depositAmount, depositHandle, depositProof]);

    const { handle: withdrawHandle, handleProof: withdrawProof } =
      await nox.encryptInput(withdrawAmount, "uint256", vault.address);
    await vault.write.requestWithdraw([withdrawHandle, withdrawProof]);

    const requestId = await vault.read.withdrawalCount();
    const request = await readWithdrawalRequest(vault, requestId);
    const { value: decryptedAmount, decryptionProof } = await waitForPublicDecrypt(
      request.amount as `0x${string}`
    );

    await vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof]);

    await assert.rejects(
      () => vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof]),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("reverts on zero-amount deposit", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const { handle, handleProof } = await nox.encryptInput(
      0n,
      "uint256",
      vault.address
    );

    await assert.rejects(
      () => vault.write.deposit([0n, handle, handleProof]),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("allows owner to expire an expired withdrawal request", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n;
    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depositHandle, handleProof: depositProof } =
      await nox.encryptInput(depositAmount, "uint256", vault.address);
    await vault.write.deposit([depositAmount, depositHandle, depositProof]);

    const withdrawAmount = 500n;
    const { handle: withdrawHandle, handleProof: withdrawProof } =
      await nox.encryptInput(withdrawAmount, "uint256", vault.address);
    await vault.write.requestWithdraw([withdrawHandle, withdrawProof]);

    const requestId = await vault.read.withdrawalCount();

    await connection.viem.test.increaseTime({ seconds: 3n * 24n * 60n * 60n + 1n });
    await connection.viem.test.mine({ blocks: 1 });

    await vault.write.expireWithdrawal([requestId]);

    const request = await readWithdrawalRequest(vault, requestId);
    assert.equal(request.finalized, true);
  });

  it("reverts if non-owner tries to inject yield", async () => {
    const connection = await makeConnection();
    const attacker = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const yieldAmount = 100n;
    await mockToken.write.mint([attacker.walletClient.account.address, yieldAmount]);
    await mockToken.write.approve([vault.address, yieldAmount]);

    const { handle, handleProof } = await nox.encryptInput(
      yieldAmount,
      "uint256",
      vault.address
    );

    await assert.rejects(
      () =>
        vault.write.injectYield([yieldAmount, handle, handleProof], {
          account: attacker.walletClient.account,
        }),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("reverts if non-owner non-user tries to finalize withdrawal", async () => {
    const connection = await makeConnection();
    const attacker = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n;
    const withdrawAmount = 400n;

    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depositHandle, handleProof: depositProof } =
      await nox.encryptInput(depositAmount, "uint256", vault.address);
    await vault.write.deposit([depositAmount, depositHandle, depositProof]);

    const { handle: withdrawHandle, handleProof: withdrawProof } =
      await nox.encryptInput(withdrawAmount, "uint256", vault.address);
    await vault.write.requestWithdraw([withdrawHandle, withdrawProof]);

    const requestId = await vault.read.withdrawalCount();
    const request = await readWithdrawalRequest(vault, requestId);
    const { value: decryptedAmount, decryptionProof } = await waitForPublicDecrypt(
      request.amount as `0x${string}`
    );

    // Attacker cannot finalize another user's withdrawal
    await assert.rejects(
      () => vault.write.finalizeWithdraw([
        requestId,
        decryptedAmount,
        decryptionProof,
      ], {
        account: attacker.walletClient.account,
      }),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("allows owner to inject yield", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const yieldAmount = 100n;

    await mockToken.write.mint([connection.walletClient.account.address, yieldAmount]);
    await mockToken.write.approve([vault.address, yieldAmount]);

    const { handle, handleProof } = await nox.encryptInput(
      yieldAmount,
      "uint256",
      vault.address
    );

    await vault.write.injectYield([yieldAmount, handle, handleProof]);

    const vaultBalance = await vault.read.confidentialBalanceOf([
      vault.address,
    ]) as `0x${string}`;
    const { value: injectedShares } = await waitForPublicDecrypt(vaultBalance);
    assert.equal(injectedShares, yieldAmount);
  });

  it("enforces timelock on second consecutive yield injection", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const yieldAmount = 100n;

    await mockToken.write.mint([connection.walletClient.account.address, yieldAmount * 3n]);
    await mockToken.write.approve([vault.address, yieldAmount * 3n]);

    const { handle: handle1, handleProof: proof1 } = await nox.encryptInput(
      yieldAmount,
      "uint256",
      vault.address
    );
    await vault.write.injectYield([yieldAmount, handle1, proof1]);

    // Second injection immediately after should fail due to timelock
    const { handle: handle2, handleProof: proof2 } = await nox.encryptInput(
      yieldAmount,
      "uint256",
      vault.address
    );

    await assert.rejects(
      () => vault.write.injectYield([yieldAmount, handle2, proof2]),
      { name: "ContractFunctionExecutionError" }
    );

    // Advance time past the timelock
    await connection.viem.test.increaseTime({ seconds: 24n * 60n * 60n + 1n });
    await connection.viem.test.mine({ blocks: 1 });

    // Now it should succeed
    await vault.write.injectYield([yieldAmount, handle2, proof2]);
  });

  it("enforces max yield injection limit", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    // Amount exceeding max (1000 ether)
    const hugeAmount = 2000n * 10n ** 18n;

    await mockToken.write.mint([connection.walletClient.account.address, hugeAmount]);
    await mockToken.write.approve([vault.address, hugeAmount]);

    const { handle, handleProof } = await nox.encryptInput(
      hugeAmount,
      "uint256",
      vault.address
    );

    await assert.rejects(
      () => vault.write.injectYield([hugeAmount, handle, handleProof]),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("rejects malformed proof in deposit (malformed proof fuzz)", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n;

    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle } = await nox.encryptInput(depositAmount, "uint256", vault.address);

    // Malformed proof - random bytes instead of valid proof
    const malformedProof = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await assert.rejects(
      () => vault.write.deposit([depositAmount, handle, malformedProof]),
      { name: "ContractFunctionExecutionError" }
    );
  });

  it("prevents front-running in withdraw (concurrent tx race)", async () => {
    const connection = await makeConnection();
    const attacker = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    // Deposit for user
    const depositAmount = 1000n * 10n ** 18n;
    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depHandle, handleProof: depProof } = await nox.encryptInput(
      depositAmount,
      "uint256",
      vault.address
    );

    await vault.write.deposit([depositAmount, depHandle, depProof]);
    const vaultBalanceBefore = await mockToken.read.balanceOf([vault.address]);

    // User initiates withdrawal request
    const withdrawAmount = 500n * 10n ** 18n;
    const { handle: wdHandle, handleProof: wdProof } = await nox.encryptInput(
      withdrawAmount,
      "uint256",
      vault.address
    );

    await vault.write.requestWithdraw([wdHandle, wdProof], {
      account: connection.walletClient.account,
    });

    const requestId = await vault.read.withdrawalCount();
    const request = await readWithdrawalRequest(vault, requestId);
    const { value: decryptedAmount, decryptionProof } = await waitForPublicDecrypt(
      request.amount as `0x${string}`
    );
    assert.equal(decryptedAmount, withdrawAmount);

    // Attacker cannot front-run finalizeWithdraw — access control blocks
    await assert.rejects(
      () => vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof], {
        account: attacker.walletClient.account,
      }),
      { name: "ContractFunctionExecutionError" }
    );

    // Vault balance unchanged until proper finalization
    const vaultBalanceAfter = await mockToken.read.balanceOf([vault.address]);
    assert.equal(vaultBalanceAfter, vaultBalanceBefore);

    // User can still finalize
    await vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof], {
      account: connection.walletClient.account,
    });

    const vaultBalanceFinal = await mockToken.read.balanceOf([vault.address]);
    assert.equal(vaultBalanceFinal, vaultBalanceBefore - withdrawAmount);
  });

  it("resists clock manipulation in withdrawal deadline", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n * 10n ** 18n;
    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depHandle, handleProof: depProof } = await nox.encryptInput(
      depositAmount,
      "uint256",
      vault.address
    );

    await vault.write.deposit([depositAmount, depHandle, depProof]);

    const withdrawAmount = 500n * 10n ** 18n;
    const { handle: wdHandle, handleProof: wdProof } = await nox.encryptInput(
      withdrawAmount,
      "uint256",
      vault.address
    );

    await vault.write.requestWithdraw([wdHandle, wdProof]);

    const requestId = await vault.read.withdrawalCount();
    const request = await readWithdrawalRequest(vault, requestId);
    const { value: decryptedAmount, decryptionProof } = await waitForPublicDecrypt(
      request.amount as `0x${string}`
    );

    // Jump clock forward past deadline
    await connection.viem.test.increaseTime({ seconds: 3n * 24n * 60n * 60n + 1n });
    await connection.viem.test.mine({ blocks: 1 });

    // finalizeWithdraw reverts — deadline passed
    await assert.rejects(
      () => vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof]),
      { name: "ContractFunctionExecutionError" }
    );

    // Owner can expire the withdrawal
    await vault.write.expireWithdrawal([requestId]);

    const withdrawal = await readWithdrawalRequest(vault, requestId);
    assert.equal(withdrawal.finalized, true);
  });

  it("NonReentrant guard persists on revert", async () => {
    const connection = await makeConnection();

    const mockToken = await connection.deployContract("MockERC20", [
      "Mock USDC",
      "mUSDC",
    ]);
    const vault = await connection.deployContract("PrivateVault", [
      "Private Vault Shares",
      "pvUSD",
      "",
      mockToken.address,
    ]);

    const depositAmount = 1000n * 10n ** 18n;
    await mockToken.write.mint([connection.walletClient.account.address, depositAmount]);
    await mockToken.write.approve([vault.address, depositAmount]);

    const { handle: depHandle, handleProof: depProof } = await nox.encryptInput(
      depositAmount,
      "uint256",
      vault.address
    );

    await vault.write.deposit([depositAmount, depHandle, depProof]);

    const withdrawAmount = 500n * 10n ** 18n;
    const { handle: wdHandle } = await nox.encryptInput(
      withdrawAmount,
      "uint256",
      vault.address
    );

    // requestWithdraw with malformed proof reverts during Nox.fromExternal
    const malformedProof = "0xdeadbeefdeadbeef";
    await assert.rejects(
      () => vault.write.requestWithdraw([wdHandle, malformedProof]),
      { name: "ContractFunctionExecutionError" }
    );

    // Guard not stuck — can still deposit after the revert
    await mockToken.write.mint([connection.walletClient.account.address, 100n]);
    await mockToken.write.approve([vault.address, 100n]);

    const { handle: depHandle2, handleProof: depProof2 } = await nox.encryptInput(
      100n,
      "uint256",
      vault.address
    );

    await vault.write.deposit([100n, depHandle2, depProof2]);
  });
});
