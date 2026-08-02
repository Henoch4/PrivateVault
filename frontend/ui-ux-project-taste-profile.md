---
name: private-vault-taste-profile
description: >
  Taste profile for PrivateVault — an institutional-grade MEV protection vault
  built on iExec Nox confidential computing. This profile governs all UI/UX
  decisions for the frontend application, anchoring it in real DeFi design
  references rather than AI defaults.
---

# PrivateVault — Taste Profile

## Reference sites / screenshots ("like this")

- **Aave Arc** (`https://aave.com/arc`) — Institutional DeFi dashboard with restrained color, clear data hierarchy, and trust-first positioning. Like the way they surface risk metrics upfront rather than hiding them.
- **dYdX v4** (`https://trade.dydx.xyz`) — Professional trading interface with dense but scannable data tables, clear CTA hierarchy, and a serious B2B aesthetic that doesn't shy from complexity.
- **Ribbon Finance** (`https://ribbon.finance`) — Options vault dashboard that explains complex mechanics clearly through progressive disclosure and step-by-step workflows.
- **Coinbase Wallet** (`https://wallet.coinbase.com`) — Onboarding flow that balances security seriousness with approachable guidance — relevant for wallet connection screens.
- **EigenLayer** (`https://eigen.death`) — Web3-native dashboard that uses technical terminology precisely rather than dumbing it down — audience-appropriate vocabulary.

## Explicit anti-references ("not like this")

- **Generic DeFi landing pages** with floating "Earn 100% APY" promises, blurred gradient backgrounds, and fake-perfect stats (`"Over $1B deposited"`).
- **AI-default templates**: centered hero over dark mesh, purple gradients, glassmorphism everywhere, decorative status dots, `v1.2.3` footer labels.
- **Crypto bro aesthetics**: neon accents, animated token logos, "revolutionary" buzzwords, meme-influenced typography.
- **Retail-first apps** that prioritize gamification over serious financial tools — no achievement badges, no progress bars styled like games.

## Exact values, not adjectives

- **Colors (hex codes)**:
  - Primary: `#6366f1` (indigo-500) → `#4f46e5` (indigo-600) gradient for primary CTAs
  - Secondary: `#e5e7eb` text on `#161a25` surfaces
  - Status: `#4ade80` (success-green) for protected state, `#f87171` (error-red) for warnings
  - Surfaces: `#0f1117` (darkest), `#161a25` (cards), `#1d2333` (inputs/elevated)
  - Borders: `#2a3045`
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, sans-serif`), font weights 400/500/600/700. No decorative display fonts.
- **Corner radius / spacing scale**: 12px for inputs/buttons, 16px for cards. Spacing in 0.25rem increments.
- **Brand guideline**: N/A — this is an open-source privacy tool, not a branded product. Use technical precision.

## Design Read signals

- **Page kind**: app / dashboard (not a marketing landing page — this is a functional tool)
- **Vibe words**: "serious B2B", "dark tech", "trust-first", "precision-oriented"
- **Reference signals**: Aave Arc (institutional), dYdX v4 (pro trading), Ribbon Finance (vault UX patterns)
- **Audience**: Institutional traders, hedge fund LPs, MEV-sophisticated DeFi users who understand TEEs, confidential computing, and MEV. Not retail newbies.
- **Quiet constraints**: Accessibility-first (Section 508 compliance), trust-first (security is the primary concern, not aesthetics)
- **One-line design read**: Reading this as: institutional DeFi dashboard for professional traders, with a serious B2B aesthetic language, leaning toward Aave Arc + dYdX v4 reference patterns.

## The three dials (1-10)

- **DESIGN_VARIANCE: 4** — Low variance. Clean, grid-based layouts. Symmetrical where appropriate. No experimental asymmetries.
- **MOTION_INTENSITY: 3** — Minimal motion. Only functional animations (status indicators, loading states). No decorative micro-interactions. Respects `prefers-reduced-motion`.
- **VISUAL_DENSITY: 6** — Moderate density. Professional dashboards need data density, but not at the cost of clarity. Balance scannability with breathing room.

| Signal | VARIANCE | MOTION | DENSITY |
|--------|----------|--------|---------|
| serious B2B / dark tech / trust-first | 3-4 | 2-3 | 4-5 |

## Design system vs aesthetic

This is a **dark tech aesthetic** → native CSS + Tailwind + lucide-react icons. No design system framework (ShadCN, Fluent, etc.) — this is a specialized tool, not a consumer app. Build with native CSS + Tailwind + lucide-react.

## Words you're actively avoiding

- "Revolutionary", "next-generation", "decentralized revolution"
- "Earn yield safely" / "100% safe returns"
- "Connect your wallet to get started" (too retail — use "Secure your wallet")
- "Your gateway to DeFi" (corporate buzzword)
- "Click the button below" (insulting to institutional users)
- "Easy to use" (implies simplicity that doesn't match the threat model)
- "MEV-free" (impossible claim — say "MEV-protected" or "MEV-resistance")
- "End-to-end encryption" (technically inaccurate for TEE-based confidentiality)
- "Quantum-resistant" (irrelevant to vault privacy model)

## Stage and audience

- **Stage**: Post-security-audit (5 critical vulns fixed), pre-mainnet. This is a serious tool for serious users who have experienced MEV losses.
- **Audience**: In their vocabulary — "front-running", "sandwich attacks", "position leakage", "exit strategy", "confidential computing", "TEE attestation". Not "easy", "simple", "safe".

## One thing that must differentiate this from competitors

**Confidential withdrawal timing.** While other MEV protection solutions (Flashbots Protect, private RPCs) still reveal that *a withdrawal happened* and the approximate *amount*, PrivateVault hides the withdrawal entirely until the 3-day cooldown expires — and even then, only the holder can decrypt the amount. This is the key differentiator and must be communicated consistently in UI copy, workflow labels, and information architecture.

## Mood board / image links

- Aave Arc dashboard: `https://aave.com/arc`
- dYdX v4 trading interface: `https://trade.dydx.xyz`
- Ribbon Finance vault dashboard: `https://ribbon.finance`
- Coinbase Wallet security screens: `https://wallet.coinbase.com`
- EigenLayer operator dashboard: `https://eigen.death`
- iExec Nox docs (technical reference): `https://docs.nox.party`

---

*This profile was created for: PrivateVault — MEV Protection Vault*
*Built on iExec Nox confidential computing protocol*
*Target audience: institutional traders, hedge fund LPs, MEV-sophisticated DeFi users*
