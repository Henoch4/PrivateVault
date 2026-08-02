# PrivateVault — Confidential DeFi Vault

A confidential yield vault on [iExec Nox](https://docs.iex.ec/nox-protocol/getting-started/welcome). Deposits, balances, and withdrawals are encrypted end-to-end using ERC-7984 confidential tokens and Nox TEE-based confidential computing.

**Hackathon:** iExec WTF Hackathon Summer Edition
**Chain:** Ethereum Sepolia
**Protocol:** Nox (confidential smart contracts layer)

---

## What It Does

- **Encrypted deposits** — amount is encrypted client-side via the Nox Handle SDK before reaching the chain. The vault receives an encrypted handle, never the plaintext.
- **Hidden balances** — vault shares are ERC-7984 confidential tokens. On-chain observers see only encrypted handles.
- **Private two-step withdrawals** — shares are burned first (encrypted amount), then the user decrypts off-chain and finalizes to receive their ERC-20 tokens. Requests expire after 3 days.
- **Confidential yield injection** — the vault owner can inject yield by minting confidential shares to the vault, increasing share value without revealing individual positions.
- **Selective disclosure** — only the user can decrypt their own balance. The total deposited is publicly decryptable (for TVL), while individual positions stay private.

## Why It Matters

5,000 USDC deposited into a public vault → visible on Etherscan in 30 seconds → MEV extracted in 60. Every DeFi vault leaks who deposited, how much, when they withdraw, and what strategy the vault runs. This blocks institutional capital that requires confidentiality and enables front-running on every position change.

PrivateVault demonstrates that privacy and DeFi composability can coexist — via Nox's confidential computing layer, without changing the user's wallet or requiring new infrastructure.

**Known trade-off**: the vault owner can inject yield via `injectYield` with limited cap (1000 ether) and 24-hour timelock between consecutive injections. This prevents immediate dilution but still requires trust in the owner for yield simulation. A production vault would add DAO-controlled gates, finer-grained caps, or a governance-controlled fee model.

**⚠️ Security Status**: Multiple critical vulnerabilities were identified and fixed during review. See `SECURITY.md` for full audit findings.

---

## Architecture

```
Frontend (Next.js + wagmi + @iexec-nox/handle)
  │
  │  Deposit → Encrypt amount → Submit handle
  │  Withdraw → Burn shares → Decrypt → Finalize
  │  Balance → Read encrypted handle → Decrypt client-side
  │
  ▼
PrivateVault.sol (ERC-7984)
  │
  │  deposit()         → transferFrom ERC-20 → mint ERC-7984 shares
                         • Verifies encrypted amount matches public amount
                         • Checks minimum deposit requirement (1 ether)
  │  requestWithdraw() → burn ERC-7984 → store encrypted request
                         • Enforces 1-hour rate limit between requests
                         • Uses nonReentrant modifier for protection
  │  finalizeWithdraw()→ verify proof → transfer ERC-20
                         • Only the withdrawal request owner can call this
                         • Uses nonReentrant modifier for protection
                         • Validates decryption proof matches stored amount
  │  injectYield()     → mint ERC-7984 to vault (owner only)
                         • Adds new confidential shares to vault
  │
  ▼
Nox Protocol (TEE / Intel TDX)
      Handles → encrypted data pointers
      ACL → who can decrypt what
      Gateway → off-chain decrypt / encrypt
```

### Security Model

#### Access Control
| Function | Allowed Caller | Validation |
|----------|---------------|------------|
| `deposit` | Any address | Amount verification, minimum deposit |
| `requestWithdraw` | Any user | Rate limit (1hr), nonReentrant |
| `finalizeWithdraw` | Withdrawal owner or vault owner | Access control check, nonReentrant |
| `injectYield` | Only owner | `onlyOwner` modifier |
| `expireWithdrawal` | Only owner | `onlyOwner` modifier |

#### Error Codes
- `InsufficientBalance` — Not enough shares for withdrawal
- `AlreadyFinalized` — Withdrawal already processed
- `InvalidProof` — Decryption proof mismatch
- `RequestExpired` — Withdrawal deadline (3 days) passed
- `WithdrawalNotExpired` — Cannot expire active request
- `ZeroDeposit` — Deposit amount is zero or below minimum
- `PublicAmountMismatch` — Encrypted amount doesn't match public amount
- `InvalidEncryptedAmount` — Invalid encrypted handle
- `AccessControlViolation` — Unauthorized withdrawal finalization
- `RateLimitNotExpired` — Withdrawal cooldown period active
```

---

## Quick Start

### Prerequisites

- Node.js 22+
- Docker Desktop (running) — required for the Nox offchain stack used in tests
- A wallet with Sepolia ETH (get from [faucet](https://sepoliafaucet.com/))

### 1. Install

```bash
cd private-vault-nox
npm install
```

### 2. Compile

```bash
npx hardhat compile
```

### 3. Test (requires Docker Desktop running)

```bash
# Start Docker Desktop first, then run:
npx hardhat test
```

The `@iexec-nox/nox-hardhat-plugin` automatically manages Docker containers for the Nox offchain stack (KMS, gateway, etc.) during test execution.

### 4. Deploy to Sepolia

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.public.blastapi.io"
export PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run deploy:sepolia
```

Copy the deployed addresses into the frontend's Settings panel.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, configure contract addresses in Settings.

---

## Smart Contracts

### PrivateVault.sol

Extends ERC-7984 (confidential token standard from Nox).

| Function | What it does | Privacy |
|---|---|---|
| `deposit(publicAmount, encryptedAmount, proof)` | Transfers ERC-20, mints ERC-7984 shares | Amount encrypted via Nox handle |
| `requestWithdraw(encryptedAmount, proof)` | Burns shares, creates withdrawal request (3-day expiry) | Amount never visible on-chain |
| `finalizeWithdraw(requestId, decryptedAmount, proof)` | Verifies decryption proof, transfers ERC-20 | Proof validated on-chain, only user can decrypt |
| `expireWithdrawal(requestId)` | Owner-only — marks request as expired after deadline | Prevents stale locked requests |
| `injectYield(publicAmount, encryptedAmount, proof)` | Owner mints shares to vault (yield injection) | Encrypted minting, no dilution cap (see above) |
| `confidentialBalanceOf(user)` | Returns encrypted balance handle | Only decryptable by `user` |
| `confidentialTotalDeposited()` | Returns encrypted total deposits | Publicly decryptable |

### MockERC20.sol

Simple ERC-20 token for testing. On Sepolia, any ERC-20 works.

---

## Nox Integration

### Components used

1. **`@iexec-nox/nox-confidential-contracts`** — ERC-7984 confidential token implementation
2. **`@iexec-nox/nox-protocol-contracts`** — Nox Solidity library (`Nox.sol`) for encrypted arithmetic, comparisons, ACL
3. **`@iexec-nox/nox-hardhat-plugin`** — Local testing with the full Nox offchain stack
4. **`@iexec-nox/handle`** — JS SDK for client-side encryption/decryption

### Confidentiality patterns

| Pattern | Used for |
|---|---|
| `Nox.fromExternal()` | Convert client-encrypted input to in-contract `euint256` |
| `Nox.add()` / `Nox.sub()` | Encrypted arithmetic on `_totalDeposited` |
| `Nox.allowThis()` | Grant contract access to encrypted values |
| `Nox.allow()` | Grant specific accounts decryption rights |
| `Nox.toEuint256()` | Wrap a plaintext value as an encrypted handle |
| `Nox.publicDecrypt()` | Verify decryption proofs on-chain |

---

## Project Structure

```
private-vault-nox/
├── contracts/
│   ├── PrivateVault.sol      # Confidential vault
│   └── MockERC20.sol         # Test token
├── test/
│   └── PrivateVault.test.ts  # 9 tests (happy paths + edge cases)
├── scripts/
│   └── deploy.ts             # Sepolia deployment
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Main dApp page
│   │   ├── providers.tsx     # wagmi + app config
│   │   └── globals.css       # Dark theme
│   ├── components/
│   │   ├── VaultDashboard.tsx # Overview + loading skeletons
│   │   ├── DepositForm.tsx    # Encrypted deposit flow
│   │   ├── WithdrawForm.tsx   # Two-step private withdrawal
│   │   ├── BalanceViewer.tsx  # Client-side decryption
│   │   └── ConfigPanel.tsx    # Contract address settings
│   └── package.json
├── hardhat.config.ts
├── package.json
├── feedback.md               # iExec Nox feedback
└── README.md
```

---

## Tests

9 tests covering:

| Test | What it guards |
|---|---|
| Deploy + init | Zero total deposited on deploy |
| Encrypted deposit | Handle → mint → total tracking |
| Balance decrypt | User can decrypt own balance via ACL |
| Two-step withdrawal | Request → burn → decrypt → finalize → token transfer |
| Double finalize | Reverts on already-finalized request |
| Zero deposit | Reverts on `MIN_DEPOSIT` violation |
| Withdrawal expiry | Owner can expire stale requests after deadline |
| Non-owner yield | Reverts when non-owner calls `injectYield` |
| Owner yield | Owner can mint shares to vault |

---

## Hackathon Evaluation

| Criterion | How we address it |
|---|---|
| Creativity | Confidential yield vault — novel combination of ERC-7984 + Nox |
| End-to-end (no mock data) | Real ERC-20 deposits, Nox encryption/decryption, Sepolia deployment |
| Deployed on ETH Sepolia | Contracts via Hardhat; frontend connects to Sepolia |
| feedback.md | See `feedback.md` |
| 4 min video | Demo video in X post submission |
| Technical implementation | Deep Nox integration: handles, ACL, TEE, public decrypt, two-step withdrawal |
| UX | Dark-mode UI with guided deposit/withdraw flows |

---

## License

MIT

---

## Security & Testing

### ⚠️ Security Status
**Critical vulnerabilities identified and patched during review. See `SECURITY.md` for full audit findings.**

### Security Fixes Implemented
1. **Amount Verification** - Verifies encrypted amount matches public amount before processing deposit
2. **Access Control** - Only withdrawal request owner can call `finalizeWithdraw` (removed owner bypass vulnerability)
3. **Rate Limiting** - 1-hour cooldown between withdrawal requests (with DoS protection)
4. **Reentrancy Protection** - Proper mutex pattern with `_NOT_ENTERED`/`_ENTERED` states
5. **Yield Injection Controls**:
   - Maximum yield cap: 1000 ether per injection
   - 24-hour timelock between consecutive yield injections
6. **Frontend Type Safety** - Fixed encrypted handle being treated as plaintext balance
7. **Withdrawal Expiration** - 3-day deadline enforcement

### Test Suite
- Core functionality tests (`test/PrivateVault.test.ts`) using Hardhat + Nox plugin
- Security tests: Access control, rate limiting, injection limits, timelock enforcement
- Requires Docker for full Nox stack testing

### Documentation
- [Security Policy](SECURITY.md) - Full audit and threat model
- [Audit Report](AUDIT.md) - Detailed vulnerability findings
- [Phase 2: Testing Framework](PHASE2.md) - Testing documentation
- [Phase 3: Documentation & Deployment](PHASE3.md) - Deployment guide
- [Phase 4: Final QA Checklist](CHECKLIST.md) - Verification checklist
