---
name: shareenv-crypto-engineering
description: Security-first engineering workflow for ShareEnv. Use when implementing or reviewing cryptography, envelope schema changes, zero-knowledge API behavior, key management, threat model updates, or npm package extraction for reusable crypto APIs.
---

# ShareEnv Crypto Engineering Skill

This skill enforces protocol-first, threat-model-driven development.

## When To Use

Use this skill whenever work touches:

- `lib/crypto/**`
- `app/actions/**`
- `lib/server/**`
- envelope schema or algorithms
- passphrase, KDF, encryption, or MAC behavior
- persistence model for encrypted envelopes

## Non-Negotiable Invariants

- Plaintext secrets never leave the client.
- Passphrases never leave the client.
- Every envelope decrypt path verifies MAC first.
- API stores opaque ciphertext blobs only.
- Protocol docs and threat model must be updated with semantic crypto changes.

## Required Workflow

1. Update protocol spec first.
2. Update threat model for the new behavior.
3. Implement code changes with explicit types.
4. Add or update validation logic for envelope schema.
5. Run quality checks and resolve security-relevant findings.
6. Document migration impacts in roadmap when wire format changes.

## Review Checklist

See:

- `references/protocol-change-checklist.md`
- `references/release-gates.md`
