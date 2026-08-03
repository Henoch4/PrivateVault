"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Lock, Moon, ShieldCheck, Sun, Wallet } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { truncateAddress } from "@/lib/contracts";
import { VaultDashboard } from "@/components/VaultDashboard";
import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { BalanceViewer } from "@/components/BalanceViewer";
import { ConfigPanel } from "@/components/ConfigPanel";
import { useTheme } from "@/components/ThemeProvider";

type Tab = "overview" | "deposit" | "withdraw" | "balances" | "config";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
  { id: "balances", label: "Balances" },
  { id: "config", label: "Configuration" },
];

const PROPS = [
  {
    icon: ShieldCheck,
    title: "MEV-protected",
    body: "Deposits and withdrawals are encrypted inside a TEE, resistant to front-running and sandwich attacks.",
  },
  {
    icon: Lock,
    title: "Zero position leakage",
    body: "Confidential balances and deposit amounts are only decryptable by the holder.",
  },
  {
    icon: Wallet,
    title: "Confidential withdrawal timing",
    body: "A withdrawal stays invisible until the 3-day cooldown expiry. Only then, and only by the holder, can the amount be decrypted.",
  },
  {
    icon: Lock,
    title: "Trusted execution",
    body: "Built on iExec Nox confidential computing (ERC-7984) with TEE attestation.",
  },
];

function Landing() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">MEV Protection Vault</p>
        <h1>
          Private<span className="text-gradient">Vault</span>
        </h1>
        <p className="lede">
          A confidential ERC-7984 vault that protects institutional positions
          from MEV. Encrypted in a TEE on iExec Nox. No position leakage, no
          visible exit strategy.
        </p>
        <div className="hero-stats" aria-label="Product facts">
          <div className="hero-stat">
            <div className="metric-label">Cooldown</div>
            <div className="metric-value">3 days</div>
          </div>
          <div className="hero-stat">
            <div className="metric-label">Standard</div>
            <div className="metric-value">ERC-7984</div>
          </div>
          <div className="hero-stat">
            <div className="metric-label">Compute</div>
            <div className="metric-value">Attested TEE</div>
          </div>
          <div className="hero-stat">
            <div className="metric-label">Position leakage</div>
            <div className="metric-value">Zero</div>
          </div>
        </div>
      </section>

      <div className="callout" role="note">
        <Lock aria-hidden="true" />
        <p>
          <strong>The differentiator:</strong> while private RPCs still reveal
          that a withdrawal happened and its approximate amount, PrivateVault
          hides the withdrawal entirely until the 3-day cooldown expiry. Even
          then, only the holder can decrypt the amount.
        </p>
      </div>

      <section aria-labelledby="props-heading">
        <h2 id="props-heading" className="card-subtitle">
          Institutional-grade protection
        </h2>
        <div className="prop-grid">
          {PROPS.map((prop) => {
            const Icon = prop.icon;
            return (
              <article className="prop" key={prop.title}>
                <span className="prop-icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <h3>{prop.title}</h3>
                <p>{prop.body}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function Page() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");

  const injector = connectors.find((connector) => connector.id === "injected");

  return (
    <main className="container">
      <header className="header">
        <span className="brand">
          <span className="brand-mark">
            <ShieldCheck aria-hidden="true" size={16} />
          </span>
          PrivateVault
        </span>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          {isConnected && address ? (
            <>
              <span className="status">
                <span className="status-dot" aria-hidden="true" />
                <span className="wallet-address">{truncateAddress(address)}</span>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => injector && connect({ connector: injector })}
              disabled={!injector || isPending}
            >
              <Wallet size={18} aria-hidden="true" />
              Secure your wallet
            </button>
          )}
        </div>
      </header>

      <ErrorBoundary>
        {!isConnected ? (
          <Landing />
        ) : (
          <>
            <nav className="tabs" role="tablist" aria-label="Vault sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="tab"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {tab === "overview" && <VaultDashboard />}
            {tab === "deposit" && <DepositForm />}
            {tab === "withdraw" && <WithdrawForm />}
            {tab === "balances" && <BalanceViewer />}
            {tab === "config" && <ConfigPanel />}
          </>
        )}
      </ErrorBoundary>
    </main>
  );
}
