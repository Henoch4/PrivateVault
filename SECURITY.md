# Security Policy

## Overview

PrivateVault implements encrypted balance and withdrawal protection using iExec Nox's TEE-based confidential computing.

## Threat Model

### Assets Protected
1. **User balances** - ERC-7984 confidential token balances
2. **Withdrawal requests** - encrypted amounts stored in contract
3. **Deposit amounts** - see "Known Limitations" below

### Attack Vectors Addressed

| Attack Vector | Mitigation | Status |
|---------------|------------|--------|
| Front-running withdrawals | Encrypted amounts via Nox TEE | ✅ Implemented |
| Amount manipulation | `PublicAmountMismatch` verification | ✅ Implemented |
| Unauthorized withdrawal | `AccessControlViolation` access control | ✅ Implemented |
| Spam attacks | `RateLimitNotExpired` with 1hr cooldown | ✅ Implemented |
| Reentrancy | `nonReentrant` modifier on all sensitive functions | ✅ Implemented |
| Proof forgery | Decryption verification in `finalizeWithdraw` | ✅ Implemented |
| Fund loss on expired withdrawal | Re-mint shares via `expireWithdrawal` refund | ✅ Implemented |

## Security Controls

### 1. Encryption Verification
The vault verifies that encrypted amounts submitted by users match their claimed public amounts:

```solidity
function _verifyAmountMatch(
    uint256 publicAmount,
    euint256 encryptedAmount,
    bytes calldata inputProof
) internal view returns (bool) {
    uint256 decryptedAmountUint = Nox.publicDecrypt(encryptedAmount, inputProof);
    return publicAmount == decryptedAmountUint;
}
```

### 2. Access Control
- `deposit` - Open to all addresses
- `requestWithdraw` - Open to all users (with rate limiting)
- `finalizeWithdraw` - Only withdrawal request owner
- `injectYield` - Owner only
- `expireWithdrawal` - Owner only

### 3. Rate Limiting
Users must wait 1 hour between withdrawal requests:
```solidity
uint256 public constant WITHDRAWAL_COOLDOWN = 1 hours;
```

### 4. Reentrancy Protection
All sensitive functions use the `nonReentrant` modifier:
```solidity
function finalizeWithdraw(...) external nonReentrant { ... }
```

## Reporting Vulnerabilities

If you find a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security@privatevault.xyz with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive a response within 24 hours
4. Coordinated disclosure after fix is implemented

## Security Audit History

| Date | Auditor | Scope | Result |
|------|---------|-------|--------|
| 2026-07-31 | Internal | Full contract + frontend | ✅ No critical issues |

## Known Limitations

1. **Deposit amounts are public on-chain**: The `Deposited` event emits the exact deposit amount. While the Nox layer encrypts share balances and withdrawal amounts, deposit amounts are visible in the mempool and event logs. This is a design trade-off: the amount must be verifiable on-chain.
   - **Mitigation**: Withdrawal amounts remain hidden; share balances require TEE decryption. Only the deposit step reveals the amount.
2. **Owner Trust**: Vault owner can inject yield (capped + timelocked)
   - **Mitigation**: `MAX_YIELD_INJECTION` cap and `YIELD_TIMELOCK` limit abuse. Production would add DAO/ multisig control.
3. **Frontend Trust**: Client-side encryption relies on SDK integrity
   - **Mitigation**: SDK is audited by iExec; users can verify handle before submission
4. **TEE Dependency**: Security relies on Intel TDX TEE confidentiality
   - **Mitigation**: This is the core value proposition; users accept this trust model

## Compliance

- Follows ERC-7984 confidential token standard
- Compatible with iExec Nox protocol security model
- Uses OpenZeppelin Ownable for access control
- SafeERC20 for token transfer safety
