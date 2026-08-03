"use client";

import { useState, type FormEvent } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { Loader2 } from "lucide-react";
import { privateVaultAbi, isAddress, isZeroAddress } from "@/lib/contracts";
import { useAppConfig } from "@/app/providers";

function Status({
  pending,
  success,
  error,
  pendingLabel,
}: {
  pending: boolean;
  success: boolean;
  error: boolean;
  pendingLabel: string;
}) {
  if (!pending && !success && !error) return null;
  return (
    <div
      className={success ? "alert alert-success" : error ? "alert alert-error" : "alert alert-info"}
      role={error ? "alert" : "status"}
      aria-live={success ? "polite" : "assertive"}
    >
      {pending ? (
        <span className="status">
          <Loader2 className="spin" size={16} aria-hidden="true" />
          {pendingLabel} pending…
        </span>
      ) : success ? (
        `${pendingLabel} confirmed`
      ) : (
        `${pendingLabel} failed`
      )}
    </div>
  );
}

export function WithdrawForm() {
  const { vaultAddress } = useAppConfig();
  const vault = isAddress(vaultAddress) ? (vaultAddress as Address) : undefined;
  const configured = Boolean(vault) && !isZeroAddress(vaultAddress);

  const [reqHandle, setReqHandle] = useState("");
  const [reqProof, setReqProof] = useState("");

  const [reqId, setReqId] = useState("");
  const [decAmount, setDecAmount] = useState("");
  const [decProof, setDecProof] = useState("");

  const request = useWriteContract();
  const finalize = useWriteContract();
  const requestReceipt = useWaitForTransactionReceipt({ hash: request.data });
  const finalizeReceipt = useWaitForTransactionReceipt({ hash: finalize.data });

  const validReqHandle = /^0x[0-9a-fA-F]{64}$/.test(reqHandle.trim());
  const validReqProof = /^0x[0-9a-fA-F]+$/.test(reqProof.trim());
  const validReqId = /^[0-9]+$/.test(reqId.trim());
  const validDecAmount = /^[0-9]+$/.test(decAmount.trim());
  const validDecProof = /^0x[0-9a-fA-F]+$/.test(decProof.trim());

  const canRequest = configured && validReqHandle && validReqProof;
  const canFinalize = configured && validReqId && validDecAmount && validDecProof;

  const handleRequest = (event: FormEvent) => {
    event.preventDefault();
    if (!vault) return;
    request.writeContract({
      address: vault,
      abi: privateVaultAbi,
      functionName: "requestWithdraw",
      args: [reqHandle.trim() as Address, reqProof.trim() as `0x${string}`],
    });
  };

  const handleFinalize = (event: FormEvent) => {
    event.preventDefault();
    if (!vault) return;
    finalize.writeContract({
      address: vault,
      abi: privateVaultAbi,
      functionName: "finalizeWithdraw",
      args: [
        BigInt(reqId.trim()),
        BigInt(decAmount.trim()),
        decProof.trim() as `0x${string}`,
      ],
    });
  };

  if (!configured) {
    return (
      <div className="alert alert-info" role="note">
        Set the vault address in the Configuration tab to enable withdrawals.
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      <form className="card card-accent" onSubmit={handleRequest}>
        <h2 className="card-title">Step 1: Request</h2>
        <p className="card-subtitle">
          Creates a confidential withdrawal request. Invisible until the 3-day
          cooldown expires.
        </p>

        <div className="field">
          <label htmlFor="wd-request-handle" className="field-label">
            Encrypted amount handle
          </label>
          <input
            id="wd-request-handle"
            className="input mono"
            type="text"
            placeholder="0x…"
            value={reqHandle}
            onChange={(event) => setReqHandle(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="wd-request-proof" className="field-label">
            Proof
          </label>
          <textarea
            id="wd-request-proof"
            className="input"
            value={reqProof}
            onChange={(event) => setReqProof(event.target.value)}
            placeholder="0x…"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!request.writeContract || !canRequest}
        >
          {request.isPending ? "Requesting…" : "Request withdrawal"}
        </button>
        <Status
          pending={request.isPending}
          success={requestReceipt.isSuccess}
          error={requestReceipt.isError}
          pendingLabel="Withdrawal request"
        />
      </form>

      <form className="card card-accent" onSubmit={handleFinalize}>
        <h2 className="card-title">Step 2: Finalize</h2>
        <p className="card-subtitle">
          After the cooldown expires, decrypt the amount and finalize.
        </p>

        <div className="field">
          <label htmlFor="wd-reqid" className="field-label">
            Request ID
          </label>
          <input
            id="wd-reqid"
            className="input"
            type="text"
            inputMode="numeric"
            value={reqId}
            onChange={(event) => setReqId(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="wd-dec-amount" className="field-label">
            Decrypted amount (wei)
          </label>
          <input
            id="wd-dec-amount"
            className="input"
            type="text"
            inputMode="numeric"
            value={decAmount}
            onChange={(event) => setDecAmount(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="wd-dec-proof" className="field-label">
            Decryption proof
          </label>
          <textarea
            id="wd-dec-proof"
            className="input"
            value={decProof}
            onChange={(event) => setDecProof(event.target.value)}
            placeholder="0x…"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!finalize.writeContract || !canFinalize}
        >
          {finalize.isPending ? "Finalizing…" : "Finalize withdrawal"}
        </button>
        <Status
          pending={finalize.isPending}
          success={finalizeReceipt.isSuccess}
          error={finalizeReceipt.isError}
          pendingLabel="Finalize"
        />
      </form>
    </div>
  );
}
