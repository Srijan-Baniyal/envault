# ShareEnv Roadmap

## Phase 0: Foundations (current)

- Protocol v1 specification completed.
- Threat model baseline completed.
- Client-side encryption + MAC implementation in repo.
- Zero-knowledge API scaffold completed.
- Additive wire-format extension: Argon2id KDF profile support in `kdf` object.
- Optional asymmetric CEK-wrapper helpers for recipient transport flows.

## Phase 1: Validation and Hardening

- Add unit tests for crypto round-trip and tamper rejection.
- Add integration tests for API create/fetch/delete flows.
- Add stricter passphrase policy and UX messaging.
- Add structured audit logging without payload bodies.

## Phase 2: Persistence and Policy

- Replace in-memory store with durable backend.
- Add per-envelope owner token for authorized deletion.
- Add rate limits and abuse prevention controls.
- Add automatic background purge for expired envelopes.

## Phase 3: npm Package Extraction

- Extract `lib/crypto` into `@shareenv/crypto` package.
- Publish typed API:
  - `createEnvironmentEnvelope`
  - `openEnvironmentEnvelope`
  - `validateSecretEnvelope`
- Add semver policy and changelog automation.

## Phase 4: Advanced Cryptography

- Add Argon2id profile for stronger brute-force resistance.
- Add recipient public-key envelope mode.
- Add optional multi-recipient support.
- Add interoperable test vectors.

## Exit Criteria for v1 Production

- Independent cryptography review completed.
- 100 percent passing tests and CI quality gates.
- Incident response runbook for key compromise scenarios.
- Deployment with HTTPS + secure headers + monitored error budgets.
