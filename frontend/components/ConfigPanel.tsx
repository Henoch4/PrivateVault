"use client";

import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { isAddress } from "@/lib/contracts";
import { DEFAULT_NOX_COMPUTE, useAppConfig } from "@/app/providers";

export function ConfigPanel() {
  const {
    vaultAddress,
    tokenAddress,
    noxComputeAddress,
    setVaultAddress,
    setTokenAddress,
    setNoxComputeAddress,
  } = useAppConfig();

  const [vaultInput, setVaultInput] = useState(vaultAddress);
  const [tokenInput, setTokenInput] = useState(tokenAddress);
  const [noxInput, setNoxInput] = useState(noxComputeAddress);

  const vaultValid = vaultInput === "" || isAddress(vaultInput.trim());
  const tokenValid = tokenInput === "" || isAddress(tokenInput.trim());
  const noxValid = noxInput === "" || isAddress(noxInput.trim());

  const handleApply = (event: FormEvent) => {
    event.preventDefault();
    if (!vaultValid || !tokenValid || !noxValid) return;
    setVaultAddress(vaultInput.trim());
    setTokenAddress(tokenInput.trim());
    setNoxComputeAddress(noxInput.trim());
  };

  const handleReset = () => {
    setVaultInput("");
    setTokenInput("");
    setNoxInput(DEFAULT_NOX_COMPUTE);
    setVaultAddress("");
    setTokenAddress("");
    setNoxComputeAddress(DEFAULT_NOX_COMPUTE);
  };

  return (
    <form className="card stack" onSubmit={handleApply}>
      <h2 className="card-title">Deployed contract addresses</h2>
      <p className="card-subtitle">
        Point the interface at the vault, token, and Nox Compute deployments.
      </p>

      <div className="field">
        <label htmlFor="cfg-vault" className="field-label">
          PrivateVault address
        </label>
        <input
          id="cfg-vault"
          className="input mono"
          type="text"
          value={vaultInput}
          onChange={(event) => setVaultInput(event.target.value)}
          aria-invalid={!vaultValid}
        />
        {!vaultValid ? (
          <span className="field-hint" style={{ color: "var(--color-accent-red)" }}>
            Invalid address
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="cfg-token" className="field-label">
          Token address
        </label>
        <input
          id="cfg-token"
          className="input mono"
          type="text"
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          aria-invalid={!tokenValid}
        />
        {!tokenValid ? (
          <span className="field-hint" style={{ color: "var(--color-accent-red)" }}>
            Invalid address
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="cfg-nox" className="field-label">
          Nox Compute address
        </label>
        <input
          id="cfg-nox"
          className="input mono"
          type="text"
          value={noxInput}
          onChange={(event) => setNoxInput(event.target.value)}
          aria-invalid={!noxValid}
        />
        {!noxValid ? (
          <span className="field-hint" style={{ color: "var(--color-accent-red)" }}>
            Invalid address
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!vaultValid || !tokenValid || !noxValid}
        >
          Apply configuration
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>
          <RotateCcw size={16} aria-hidden="true" />
          Reset to defaults
        </button>
      </div>
    </form>
  );
}
