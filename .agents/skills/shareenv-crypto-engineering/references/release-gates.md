# Security Release Gates

All gates must pass before production release.

## Gate 1: Code Quality

- `bun x ultracite check` passes.
- Type checking passes with strict mode.

## Gate 2: Crypto Correctness

- Envelope round-trip decryption verified.
- Tamper detection verified (MAC mismatch).
- Invalid schema rejection verified.

## Gate 3: Operational Security

- HTTPS enforced in deployment.
- API request bodies excluded from production logs.
- Retention policy configured for envelope cleanup.

## Gate 4: Documentation Completeness

- Protocol spec and threat model reflect current behavior.
- Incident handling notes documented for key/passphrase compromise scenarios.
