# ShareEnv Architecture Overview

## 1. System Summary

ShareEnv is a zero-knowledge environment-sharing platform:

- Client performs encryption and decryption.
- Server stores opaque encrypted envelopes.
- Integrity is verified with a MAC before decrypting.

## 2. High-Level Components

1. Crypto module (`lib/crypto`)
   - Envelope type definitions
   - Encoding and runtime helpers
   - KDF (PBKDF2 and Argon2id), encryption, MAC, and verification flows
   - Optional asymmetric envelope transport wrapper helpers

2. RSC service module (`lib/server/envelope-service`)
   - Cached server reads with `use cache`
   - Cache tagging and lifetime controls

3. Server actions module (`app/actions/envelope-actions.ts`)
   - Store encrypted envelope action
   - Consume encrypted envelope action
   - Delete envelope action

4. Storage module (`lib/server/zk-store`)
   - In-memory reference store for v1
   - TTL and one-time retrieval semantics

5. Documentation and controls (`docs/`, `AGENTS.md`, `.agents/skills`)
   - Protocol specification
   - Threat model
   - Development workflow and quality gates

## 3. Request Flow

## 3.1 Create

1. Client creates `SecretEnvelopeV1` from env map + passphrase.
2. Client submits encrypted envelope JSON through a server action form.
3. Server stores envelope without decryption.
4. Cache tag is updated so RSC views reflect changes.

## 3.2 Retrieve

1. Client submits envelope id through consume server action.
2. Server returns and consumes envelope in zero-knowledge storage layer.
3. Client-side decrypt flow remains passphrase-local.

## 4. Core Engineering Rules

- Zero plaintext on server, always.
- No passphrase persistence.
- Schema-validate all inbound API payloads.
- Prefer immutable typed objects in crypto path.
- Keep protocol constants explicit and versioned.

## 5. Persistence Strategy

- v1 uses in-memory storage for rapid protocol development.
- Next migration target: Postgres or Redis with envelope JSON blob column and strict retention policy.

## 6. Packaging Strategy

The codebase is organized so crypto logic can move into a standalone npm package:

- `lib/crypto` has no Next.js-specific dependencies.
- RSC services and server actions consume exported crypto types and validators.
- Envelope schema is documented independently of framework.

## 7. Security Review Checklist

- Threat model updated for each protocol change.
- Backward compatibility check on envelope version.
- Lint + type check + static security scan on each PR.
- Negative tests for tampered envelope and wrong passphrase.
