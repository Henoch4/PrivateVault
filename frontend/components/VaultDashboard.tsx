"use client";

import { Info, ShieldCheck } from "lucide-react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { privateVaultAbi, isAddress, isZeroAddress } from "@/lib/contracts";
import { useAppConfig } from "@/app/providers";
import { Tooltip } from "@/components/Tooltip";

export function VaultDashboard() {
  const { vaultAddress } = useAppConfig();
  const vault = isAddress(vaultAddress) ? (vaultAddress as Address) : undefined;
  const configured = Boolean(vault) && !isZeroAddress(vaultAddress);

  const { data: withdrawalCount } = useReadContract({
    address: vault,
    abi: privateVaultAbi,
    functionName: "withdrawalCount",
  });

  const { data: vaultOwner } = useReadContract({
    address: vault,
    abi: privateVaultAbi,
    functionName: "owner",
  });

  return (
    <div className="stack">
      <div className="card card-accent">
        <div className="stack">
          <div className="status">
            <span
              className={configured ? "status-dot pulse" : "status-dot warn"}
              aria-hidden="true"
            />
            <span style={{ fontSize: "1rem" }}>
              {configured ? "Protected" : "Vault not configured"}
            </span>
          </div>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Live MEV protection posture
          </p>
          {!configured ? (
            <p className="field-hint">
              Set the deployed vault and token addresses in the
              Configuration tab to activate contract reads.
            </p>
          ) : null}
        </div>
      </div>

      <div className="ledger ledger-wide" aria-label="Vault metrics">
        <div className="ledger-row">
          <span className="ledger-label">Withdrawals</span>
          <span className="ledger-value">
            {withdrawalCount !== undefined ? withdrawalCount.toString() : "-"}
          </span>
        </div>
        <div className="ledger-row">
          <span className="ledger-label">Cooldown</span>
          <span className="ledger-value">3 days</span>
        </div>
        <div className="ledger-row">
          <span className="ledger-label">Owner</span>
          <span className="ledger-value ledger-value-mono">{vaultOwner ?? "-"}</span>
        </div>
      </div>

      <div className="callout" role="note">
        <Info aria-hidden="true" />
        <p>
          Withdrawals are <strong>invisible</strong> until the 3-day
          cooldown expires. During the cooldown the request exists on-chain
          but the amount is encrypted, so no MEV searcher can observe or
          front-run an exit. Only the holder can decrypt the amount, even
          after expiry.
        </p>
        <Tooltip label="ERC-7984 confidential computing on iExec Nox: deposit and withdrawal amounts are sealed in a TEE and only decryptable by authorized holders.">
          <ShieldCheck size={18} aria-label="What does Protected mean?" />
        </Tooltip>
      </div>
    </div>
  );
}
