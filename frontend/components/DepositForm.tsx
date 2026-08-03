"use client";

import { useState, type FormEvent } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import type { Address } from "viem";
import { CheckCircle2, Loader2 } from "lucide-react";
import { mockERC20Abi, privateVaultAbi, isAddress, isZeroAddress } from "@/lib/contracts";
import { useAppConfig } from "@/app/providers";
import { Tooltip } from "@/components/Tooltip";

function TxStatus({
  status,
  label,
}: {
  status: "idle" | "pending" | "success" | "error";
  label: string;
}) {
  if (status === "idle") return null;
  return (
    <div
      className={
        status === "success"
          ? "alert alert-success"
          : status === "error"
            ? "alert alert-error"
            : "alert alert-info"
      }
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "success" ? "polite" : "assertive"}
    >
      {status === "pending" ? (
        <span className="status">
          <Loader2 className="spin" size={16} aria-hidden="true" /> {label} pending…
        </span>
      ) : status === "success" ? (
        <span className="status">
          <CheckCircle2 size={16} aria-hidden="true" /> {label} confirmed
        </span>
      ) : (
        <span>{label} failed</span>
      )}
    </div>
  );
}

export function DepositForm() {
  const { vaultAddress, tokenAddress } = useAppConfig();
  const vault = isAddress(vaultAddress) ? (vaultAddress as Address) : undefined;
  const token = isAddress(tokenAddress) ? (tokenAddress as Address) : undefined;
  const configured = Boolean(vault && token) && !isZeroAddress(vaultAddress);

  const [amount, setAmount] = useState("");
  const [handle, setHandle] = useState("");
  const [proof, setProof] = useState("");

  const amountValue =
    amount !== "" && Number(amount) > 0 ? parseUnits(amount, 18) : undefined;
  const validHandle = /^0x[0-9a-fA-F]{64}$/.test(handle.trim());
  const validProof = /^0x[0-9a-fA-F]+$/.test(proof.trim());
  const canDeposit = configured && amountValue !== undefined && validHandle && validProof;

  const approve = useWriteContract();
  const deposit = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const depositReceipt = useWaitForTransactionReceipt({ hash: deposit.data });

  const handleApprove = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !vault || amountValue === undefined) return;
    approve.writeContract({
      address: token,
      abi: mockERC20Abi,
      functionName: "approve",
      args: [vault, amountValue],
    });
  };

  const handleDeposit = (event: FormEvent) => {
    event.preventDefault();
    if (!vault || amountValue === undefined) return;
    deposit.writeContract({
      address: vault,
      abi: privateVaultAbi,
      functionName: "deposit",
      args: [amountValue, handle.trim() as Address, proof.trim() as `0x${string}`],
    });
  };

  if (!configured) {
    return (
      <div className="alert alert-info" role="note">
        Set the vault and token addresses in the Configuration tab to enable
        deposits.
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      <form className="card" onSubmit={handleApprove}>
        <h2 className="card-title">Step 1 — Approve</h2>
        <p className="card-subtitle">Authorize the vault to spend tokens</p>

        <div className="field">
          <label htmlFor="deposit-amount" className="field-label">
            Deposit amount (token)
          </label>
          <input
            id="deposit-amount"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-describedby="deposit-amount-hint"
          />
          <span id="deposit-amount-hint" className="field-hint">
            Amount is encrypted in a TEE at deposit time.
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!approve.writeContract || amountValue === undefined}
        >
          {approve.isPending ? "Approving…" : "Approve"}
        </button>
        <TxStatus
          status={
            approve.isPending
              ? "pending"
              : approveReceipt.isSuccess
                ? "success"
                : approveReceipt.isError
                  ? "error"
                  : "idle"
          }
          label="Approval"
        />
      </form>

      <form className="card" onSubmit={handleDeposit}>
        <h2 className="card-title">Step 2 — Deposit</h2>
        <p className="card-subtitle">Submit the encrypted deposit</p>

        <div className="field">
          <label htmlFor="deposit-handle" className="field-label">
            Encrypted amount handle
          </label>
          <input
            id="deposit-handle"
            className="input mono"
            type="text"
            placeholder="0x…"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            aria-describedby="deposit-handle-hint"
          />
          <span id="deposit-handle-hint" className="field-hint">
            <Tooltip label="Handles and proofs are produced by the iExec Nox confidential computing stack (ERC-7984), not by this form.">
              bytes32 handle
            </Tooltip>{" "}
            from the Nox gateway.
          </span>
        </div>

        <div className="field">
          <label htmlFor="deposit-proof" className="field-label">
            Proof
          </label>
          <textarea
            id="deposit-proof"
            className="input"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            placeholder="0x…"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!deposit.writeContract || !canDeposit}
        >
          {deposit.isPending ? "Depositing…" : "Deposit"}
        </button>
        <TxStatus
          status={
            deposit.isPending
              ? "pending"
              : depositReceipt.isSuccess
                ? "success"
                : depositReceipt.isError
                  ? "error"
                  : "idle"
          }
          label="Deposit"
        />
      </form>
    </div>
  );
}
