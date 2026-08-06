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
import { DecryptDemo } from "@/components/DecryptDemo";
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

const LEDGER = [
  { label: "Cooldown", value: "3 days" },
  { label: "Standard", value: "ERC-7984" },
  { label: "Compute", value: "Attested TEE" },
  { label: "Leakage", value: "Zero" },
];

function Dial({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 150" fill="none" aria-hidden="true">
      <g className="ring-outer">
        <circle cx="75" cy="75" r="60" stroke="var(--border-strong)" strokeWidth="1" />
        <circle cx="75" cy="15" r="3" fill="var(--accent)" />
        <circle cx="75" cy="135" r="2.5" fill="var(--text-muted)" />
        <circle cx="15" cy="75" r="2.5" fill="var(--text-muted)" />
        <circle cx="135" cy="75" r="2.5" fill="var(--text-muted)" />
      </g>
      <g className="ring-inner">
        <circle
          cx="75"
          cy="75"
          r="40"
          stroke="var(--accent)"
          strokeWidth="1.2"
          strokeDasharray="2 6"
        />
        <circle cx="75" cy="35" r="2.5" fill="var(--accent-strong)" />
        <circle cx="115" cy="75" r="2" fill="var(--accent)" />
      </g>
      <circle cx="75" cy="75" r="6.5" stroke="var(--accent-border)" strokeWidth="1" />
      <circle cx="75" cy="75" r="3.5" fill="var(--accent-strong)" />
    </svg>
  );
}

function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <Dial className="hero-dial" />
        <p className="kicker">MEV protection vault · ERC-7984</p>
        <h1 className="thesis">
          Nothing leaves this vault <em>in plaintext.</em>
        </h1>
        <p className="lede">
          Institutional-grade confidential DeFi on iExec Nox. Deposits and
          withdrawals are encrypted inside a TEE, invisible to MEV searchers
          until the cooldown expires.
        </p>
      </section>

      <div className="ledger" aria-label="Product facts">
        {LEDGER.map((row) => (
          <div className="ledger-row" key={row.label}>
            <span className="ledger-label">{row.label}</span>
            <span className="ledger-value">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="field-note" role="note">
        <h3>The differentiator</h3>
        <p>
          Private RPCs reveal that a withdrawal happened, and its approximate
          amount. PrivateVault hides the withdrawal entirely until the 3-day
          cooldown expires. Even then, only the holder can decrypt the amount.
        </p>
      </div>

      <DecryptDemo />

      <section aria-labelledby="manifest-heading">
        <h2 id="manifest-heading" className="manifest-head">
          Institutional-grade protection
        </h2>
        {PROPS.map((prop, index) => {
          const Icon = prop.icon;
          return (
            <div className="entry" key={prop.title}>
              <span className="entry-num">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="entry-body">
                <h4>{prop.title}</h4>
                <p>{prop.body}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
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
    <>
      <header className="header">
        <span className="brand">
          <Dial className="brand-mark" />
          <span className="brand-name">PrivateVault</span>
        </span>
        <div className="header-actions">
          <button
            type="button"
            className="btn theme-btn"
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
              <Wallet size={16} aria-hidden="true" />
              Secure your wallet
            </button>
          )}
        </div>
      </header>

      <hr className="rule" />

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
    </>
  );
}
