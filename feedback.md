# iExec Nox Protocol — Feedback

## Project: PrivateVault (Confidential DeFi Vault)

### What Worked Well

**1. The mental model is genuinely intuitive for a privacy use case.**

The handle-based encryption ("encrypt an amount → get a handle → submit the handle → the TEE resolves it") maps closely to how developers think about file descriptors or pointers. The learning curve wasn't the *what* but the *where* — understanding which operations happen on-chain vs. in the TEE vs. on the client. Once that split is internalized, the rest of the API feels consistent.

**2. ERC-7984 as the confidential token primitive is the right abstraction.**

Implementing a vault where shares are confidential by default, without needing a separate shielded pool or zk-SNARK circuit, is exactly the kind of thing ERC-7984 should enable. The fact that `_mint`, `_burn`, and `_update` all operate on `euint256` values transparently meant we could write the vault logic almost the same way we'd write a public vault, just with encrypted types.

**3. The Hardhat plugin (`nox-hardhat-plugin`) reduces the local-dev pain meaningfully.**

Having a single `nox.connect()` call that boots the offchain stack, deploys contracts, and returns a connected client is the right DX for a protocol this complex. The alternative — manually starting a KMS, an ingestor, a runner, and a handle gateway — would have been a non-starter for a hackathon.

### Where We Hit Friction

**1. The `euint256` comparison gap is the single biggest missing piece.**

There is no straightforward way to verify `require(encryptedValue == plaintextValue)` on-chain. When a user submits both a `publicAmount` (the ERC-20 transfer amount) and an `encryptedAmount` (the confidential handle), the contract needs to verify they match. The Nox API provides `Nox.eq()` for encrypted-vs-encrypted comparison, but the result is an `euint256` (encrypted boolean) that can't directly drive a Solidity `require()` statement.

**What we did instead**: mint shares based on `publicAmount` (the actual transferred tokens) using `Nox.toEuint256(publicAmount)`, and accept the separately-encrypted handle only for validation purposes. This eliminates the mismatch attack surface entirely but makes the `encryptedAmount` parameter technically redundant for the minting path.

**What would be better**: either (a) a `Nox.requireEq(euint256, euint256)` that reverts the transaction inside the TEE if the comparison fails, or (b) a `Nox.decrypt` variant that returns a plaintext `bool` for callers with appropriate access rights, enabling standard Solidity `require()`.

**2. The offchain dependency makes `npx hardhat test` a Docker-gated operation.**

Because the Nox stack runs in Docker containers, running tests requires Docker Desktop (or Docker Engine on Linux). On Windows without Docker Desktop, this is a hard block — there's no fallback that runs a lightweight in-process mock of the offchain stack. A test-mode flag that replaces the Docker-dependent components with in-memory stubs would allow contract logic tests (state transitions, access control, edge cases) to run in CI without Docker.

**3. Error messages from the offchain stack can be opaque.**

When a Nox operation fails (e.g., `Nox.fromExternal` with an invalid proof), the revert reason that propagates to the Hardhat test runner is often a generic `ContractFunctionExecutionError` without the specific cause. Adding structured error types that survive the offchain → onchain revert boundary would significantly reduce debugging time.

**4. The `Nox.allowThis` / `Nox.allow` dance is easy to get wrong silently.**

If a contract performs an encrypted operation but forgets to call `Nox.allowThis()` on the result, downstream operations on that value fail — but they fail later, at the point of use, not at the point where the access right was omitted. A linter or compile-time check that flags `euint256` values produced without a corresponding `Nox.allowThis()` would catch this class of bug early.

**5. Documentation could be more explicit about the execution model.**

It took several reads to understand that Nox operations aren't synchronous Solidity — they emit events that the offchain stack processes asynchronously, and the results are written back to the contract's storage. The current docs describe this accurately but don't lead with it, which means the first few interactions can be confusing ("why did my `Nox.add()` not immediately update the value?"). A one-page "Execution Model" diagram showing the event → offchain processing → callback flow would close this gap.

### What Surprised Us

**The public/private decrypt duality is a genuinely useful design tool.**

The fact that the contract can selectively mark some handles as publicly decryptable (via `Nox.allow(handle, address(0))` or similar) and others as user-restricted means you can build hybrid-privacy systems where aggregate TVL is transparent while individual positions are hidden. We used this for `confidentialTotalDeposited()` — the total is decryptable by anyone (for dashboard/TVL purposes), but individual balances are only decryptable by their owner. This pattern is simple to implement but enables a much wider design space than "everything private" or "everything public."

### Summary

| Aspect | Rating (1–5) |
|---|---|
| Core API design (euint256, handles, fromExternal) | 4 |
| ERC-7984 standard | 4 |
| Hardhat plugin DX | 3 |
| Documentation clarity | 3 |
| Debugging / error messages | 2 |
| Docker-free test path | 1 |
| On-chain comparison utilities | 2 |

PrivateVault would not exist as a hackathon project without Nox — the alternative privacy approaches (Aztec, zkSync, or custom ZK circuits) have significantly steeper onboarding curves. The core value proposition is solid. The friction points above are all *fixable* without rearchitecting the protocol, and fixing them would move Nox from "impressive but takes effort to get right" to "default choice for confidential smart contracts."
