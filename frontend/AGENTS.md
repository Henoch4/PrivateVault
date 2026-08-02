# PrivateVault Frontend — AGENTS.md

This file is the table of contents for the frontend design system. Read me first, then dive deeper as needed.

## Project Identity
- **What**: MEV Protection Vault — institutional-grade confidential DeFi vault
- **Built on**: iExec Nox confidential computing protocol (ERC-7984 standard)
- **Audience**: Institutional traders, hedge fund LPs, MEV-sophisticated DeFi users
- **Vibe**: Serious B2B, dark tech, trust-first, precision-oriented

## Directory Structure
```
/frontend/
├── app/
│   ├── page.tsx          # Authenticated dashboard (tab navigation)
│   ├── layout.tsx         # Root layout — wraps with ThemeProvider
│   ├── globals.css        # Design tokens, dark/light theme vars
│   └── providers.tsx      # Wagmi providers, app config context
├── components/
│   ├── VaultDashboard.tsx # MEV protection status overview
│   ├── DepositForm.tsx    # Encrypted deposit flow (2-step: approve → deposit)
│   ├── WithdrawForm.tsx   # Two-step withdrawal (request → finalize)
│   ├── BalanceViewer.tsx  # Decrypt confidential balances
│   ├── ConfigPanel.tsx    # Vault/token/Nox contract addresses
│   ├── CustomSelect.tsx   # Glass-morphism dropdown
│   ├── Tooltip.tsx        # Hover-triggered guidance
│   ├── ErrorBoundary.tsx  # React error boundary
│   └── ThemeProvider.tsx  # Dark/light mode context
├── styles/ (N/A — using app/globals.css)
└── ui-ux-project-taste-profile.md  # Full taste profile with visual references
```

## Design System

### Color Tokens
All colors defined as CSS variables in `globals.css`:
- `--color-brand-500/600/700`: Indigo gradient for primary actions
- `--color-surface-100/200/300`: Card backgrounds (dark by default)
- `--color-border`: Border color (theme-aware)
- `--color-text-primary/secondary/tertiary`: Text hierarchy
- `--color-accent-green/red`: Status indicators

### Theme System
- Dark mode is default (institutional dark tech aesthetic)
- Toggle in header via `ThemeProvider`
- Respects `prefers-color-scheme: dark` on first load
- Persists to `localStorage`

### Component Patterns
- **Cards**: Use `.card` class (solid, not glassmorphism)
- **Buttons**: `btn-primary` (primary action) vs `btn-secondary` (supporting action)
- **Status**: `status-dot` + `pulse` animation for live indicators
- **Forms**: Always pair `<label>` with `aria-describedby`, use `ErrorBoundary` wrapper

### Accessibility Standards
- All status messages use `aria-live="polite"` (success) or `aria-live="assertive"` (errors)
- All buttons have `aria-label` with descriptive text
- All form fields have explicit `<label>` + `aria-describedby`
- `prefers-reduced-motion` media query disables all animations
- Touch targets minimum 44px

## Conventions
- **Icons**: `lucide-react` only — no mixed icon sets
- **Fonts**: System font stack — no custom web fonts
- **Motion**: Only functional animations (status indicators, loading). No decorative micro-interactions.
- **Error handling**: Separate `error` state from `status`, ErrorBoundary on every component

## References
- Full taste profile: `ui-ux-project-taste-profile.md`
- UI/UX taste standards: `../.agents/skills/software-god-agent/references/ui-ux-taste-master.md`
- Security audit: `../AUDIT.md`
