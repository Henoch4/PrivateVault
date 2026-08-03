"use client";

import { Lock } from "lucide-react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { mockERC20Abi, privateVaultAbi, isAddress, isZeroAddress } from "@/lib/contracts";
import { useAppConfig } from "@/app/providers";
import { useAccount } from "wagmi";
import { Tooltip } from "@/components/Tooltip";

export function BalanceViewer() {
  const { address } = useAccount();
  const { vaultAddress, tokenAddress } = useAppConfig();

  const vault = isAddress(vaultAddress) ? (vaultAddress as Address) : undefined;
  const token = isAddress(tokenAddress) ? (tokenAddress as Address) : undefined;
  const configured = Boolean(vault && token) && !isZeroAddress(vaultAddress);

  const { data: confidentialTotal } = useReadContract({
    address: vault,
    abi: privateVaultAbi,
    functionName: "confidentialTotalDeposited",
  });

  const { data: tokenBalance } = useReadContract({
    address: token,
    abi: mockERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  if (!configured) {
    return (
      <div className="alert alert-info" role="note">
        Set the vault and token addresses in the Configuration tab to read
        balances.
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      <div className="card card-accent">
        <h2 className="card-title">Confidential position</h2>
        <p className="card-subtitle">
          Total deposits, sealed in a TEE (ERC-7984)
        </p>
        <div className="metric" style={{ marginBottom: "0.85rem" }}>
          <div className="metric-label">Confidential total deposited</div>
          <div className="metric-value mono" style={{ fontSize: "0.82rem" }}>
            {confidentialTotal ?? "-"}
          </div>
        </div>
        <p className="field-hint">
          <Tooltip label="The handle is a ciphertext reference. The actual balance is only decryptable through the Nox confidential computing stack by an authorized holder.">
            <Lock size={14} aria-label="Encrypted" />
          </Tooltip>{" "}
          Balances are encrypted ciphertext handles. Decryption happens inside
          the Nox stack, never in the browser.
        </p>
      </div>

      <div className="card card-accent">
        <h2 className="card-title">Token balance</h2>
        <p className="card-subtitle">Public wallet token balance</p>
        <div className="metric">
          <div className="metric-label">Wallet balance</div>
          <div className="metric-value">
            {tokenBalance !== undefined ? formatUnits(tokenBalance, 18) : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
