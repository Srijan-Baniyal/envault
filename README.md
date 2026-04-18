# ShareEnv

ShareEnv is a protocol-first cryptography project for securely sharing environment
variables using client-side encryption, zero-knowledge server storage, and strict
MAC-based integrity checks.

## Core Principles

- Zero plaintext on server
- Zero passphrase transmission
- Encrypt-then-store envelopes
- Verify integrity before decrypt

## Cryptographic Profile (v1)

- KDF: PBKDF2-SHA-256 or Argon2id
- Cipher: AES-256-GCM
- Integrity: HMAC-SHA-256
- Envelope version: `shareenv.v1`

Optional transport wrapper:

- RSA-OAEP-SHA-256 wrapped CEK + AES-256-GCM payload wrapper for envelope sharing.

## Project Layout

- `lib/crypto/`: reusable envelope primitives and validation
- `lib/server/`: zero-knowledge storage and cached RSC services
- `app/actions/envelope-actions.ts`: server actions for store/consume/delete
- `docs/protocol/spec.md`: protocol contract
- `docs/security/threat-model.md`: attacker model and mitigations
- `docs/engineering/`: architecture, roadmap, and skills catalog

## Runtime Model

- Fully RSC-based rendering in `app/page.tsx`
- Cache Components enabled in `next.config.ts`
- Cached server reads via `use cache`, `cacheLife`, and `cacheTag`
- Mutations through server actions with `updateTag` cache invalidation

## Local Development

```bash
bun install
bun run dev
```

## Production Storage (Serverless)

Serverless instances do not share local filesystem state. For reliable envelope
retrieval in production, configure a shared Redis backend.

Set one of these environment-variable pairs:

- `SHAREENV_REDIS_REST_URL` and `SHAREENV_REDIS_REST_TOKEN`
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel KV naming)
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Optional:

- `SHAREENV_REDIS_KEY_PREFIX` to namespace keys (default: `shareenv`)

Without shared Redis in multi-instance production, envelope IDs can appear as
"not found" when create/read requests hit different instances.

## Quality Gates

```bash
bun x ultracite check
bun x ultracite fix
```

## Crypto Usage Example

```ts
import { createEnvironmentEnvelope } from "@/lib/crypto/primitives";
import { openEnvironmentEnvelope } from "@/lib/crypto/primitives";

const envelope = await createEnvironmentEnvelope(
	{
		DATABASE_URL: "postgres://user:pass@host:5432/db",
		API_KEY: "example-secret",
	},
	"your-strong-passphrase",
	{
		kdf: {
			name: "Argon2id",
			iterations: 3,
			memoryKiB: 65536,
			parallelism: 1,
			outputLength: 64,
		},
	},
);

const decryptedVariables = await openEnvironmentEnvelope(
	envelope,
	"your-strong-passphrase",
);

// Optional recipient transport wrapping (does not change zero-knowledge storage)
import {
	generateEnvelopeRecipientKeyPair,
	unwrapEnvelopeWithRecipientPrivateKey,
	wrapEnvelopeWithRecipientPublicKey,
} from "@/lib/crypto/asymmetric";

const keyPair = await generateEnvelopeRecipientKeyPair();
const wrapped = await wrapEnvelopeWithRecipientPublicKey(
	envelope,
	keyPair.publicKeyJwk,
);
const recoveredEnvelope = await unwrapEnvelopeWithRecipientPrivateKey(
	wrapped,
	keyPair.privateKeyJwk,
);
```

## Engineering Workflow

1. Update protocol docs before changing crypto semantics.
2. Update threat model for every trust-boundary change.
3. Implement typed code with explicit validation.
4. Run quality gates.
5. Keep zero-knowledge invariants intact.

## npm Package Direction

`lib/crypto` is intentionally framework-agnostic and structured for extraction into
`@shareenv/crypto` in a future phase.
