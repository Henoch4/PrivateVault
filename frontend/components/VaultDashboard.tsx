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
      <div className="card">
        <h2 className="card-title">Protection status</h2>
        <p className="card-subtitle">Live MEV protection posture</p>
        <span className="status">
          <span
            className={configured ? "status-dot pulse" : "status-dot warn"}
            aria-hidden="true"
          />
          {configured ? "Protected" : "Vault not configured"}
        </span>
        {!configured ? (
          <p className="field-hint" style={{ marginTop: "0.75rem" }}>
            Set the deployed vault and token addresses in the Configuration tab
            to activate contract reads.
          </p>
        ) : null}
      </div>

      <div className="metrics" aria-label="Vault metrics">
        <div className="metric">
          <div className="metric-label">Withdrawal count</div>
          <div className="metric-value">
            {withdrawalCount !== undefined ? withdrawalCount.toString() : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Cooldown</div>
          <div className="metric-value">3 days</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vault owner</div>
          <div className="metric-value mono" style={{ fontSize: "0.85rem" }}>
            {vaultOwner ?? "—"}
          </div>
        </div>
      </div>

      <div className="callout" role="note">
        <Info aria-hidden="true" />
        <p>
          Withdrawals are <strong>invisible</strong> until the 3-day cooldown
          expires. During the cooldown the request exists on-chain but the
          amount is encrypted — no MEV searcher can observe or front-run an
          exit. Only the holder can decrypt the amount, even after expiry.
        </p>
        <Tooltip label="ERC-7984 confidential computing on iExec Nox: deposit and withdrawal amounts are sealed in a TEE and only decryptable by authorized holders.">
          <ShieldCheck size={18} aria-label="What does Protected mean?" />
        </Tooltip>
      </div>
    </div>
  );
}
