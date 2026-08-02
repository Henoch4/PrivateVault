import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { nox } from "@iexec-nox/nox-hardhat-plugin";

// Hardhat v3 exposes the viem API under `connection.viem`. Attach the
// convenience accessors (`deployContract`, `walletClient`, `viem.test`) that
// this suite was written against, so calls stay concise and consistent.
async function makeConnection() {
  const connection = await nox.connect();
  const viem = connection.viem as any;
  if (!(connection as any).deployContract) {
    (connection as any).deployContract = (...args: any[]) => viem.deployContract(...args);
  }
  if (!(connection as any).walletClient) {
    (connection as any).walletClient = (await viem.getWalletClients())[0];
  }
  if (!viem.test) {
    viem.test = await viem.getTestClient();
  }
  return connection;
}

describe("PrivateVault", () => {
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
    const { value } = await nox.publicDecrypt(handle);
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
    const { value: totalDeposited } = await nox.publicDecrypt(
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

    const { value: balance } = await nox.decrypt(balanceHandle);
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
    const request = await vault.read.withdrawalRequests([requestId]);

    assert.equal(request.finalized, false);

    const { value: decryptedAmount, decryptionProof } = await nox.publicDecrypt(
      request.amount as `0x${string}`
    );
    assert.equal(decryptedAmount, withdrawAmount);

    await vault.write.finalizeWithdraw([
      requestId,
      decryptedAmount,
      decryptionProof,
    ]);

    const finalizedRequest = await vault.read.withdrawalRequests([requestId]);
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
    const request = await vault.read.withdrawalRequests([requestId]);
    const { value: decryptedAmount, decryptionProof } = await nox.publicDecrypt(
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

    await connection.viem.test.increaseTime(3 * 24 * 60 * 60 + 1);
    await connection.viem.test.mine();

    await vault.write.expireWithdrawal([requestId]);

    const request = await vault.read.withdrawalRequests([requestId]);
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
    const request = await vault.read.withdrawalRequests([requestId]);
    const { value: decryptedAmount, decryptionProof } = await nox.publicDecrypt(
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
    const { value: injectedShares } = await nox.publicDecrypt(vaultBalance);
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
    await connection.viem.test.increaseTime(24 * 60 * 60 + 1);
    await connection.viem.test.mine();

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
    const request = await vault.read.withdrawalRequests([requestId]);
    const { value: decryptedAmount, decryptionProof } = await nox.publicDecrypt(
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
    const request = await vault.read.withdrawalRequests([requestId]);
    const { value: decryptedAmount, decryptionProof } = await nox.publicDecrypt(
      request.amount as `0x${string}`
    );

    // Jump clock forward past deadline
    await connection.viem.test.increaseTime(3 * 24 * 60 * 60 + 1);
    await connection.viem.test.mine();

    // finalizeWithdraw reverts — deadline passed
    await assert.rejects(
      () => vault.write.finalizeWithdraw([requestId, decryptedAmount, decryptionProof]),
      { name: "ContractFunctionExecutionError" }
    );

    // Owner can expire the withdrawal
    await vault.write.expireWithdrawal([requestId]);

    const withdrawal = await vault.read.withdrawalRequests([requestId]);
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
