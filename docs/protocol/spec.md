# ShareEnv Cryptographic Protocol Specification (v1)

## 1. Goals

- Share environment variables without exposing plaintext to the server.
- Preserve confidentiality and integrity during storage and transport.
- Keep server responsibilities minimal: store and return opaque encrypted envelopes.
- Provide a stable wire format that can become an npm package API.

## 2. Non-Goals

- End-user identity management and authentication.
- Hardware-backed key management for v1.
- Multi-recipient key exchange in v1.

## 3. Security Model

- The client encrypts locally before upload.
- The passphrase never leaves the client.
- The server stores opaque envelopes and metadata only.
- Envelope integrity is protected by a MAC.

## 4. Envelope Format

`SecretEnvelopeV1` is the canonical transport object.

```json
{
  "version": "shareenv.v1",
  "createdAt": "2026-04-18T12:00:00.000Z",
  "kdf": {
    "name": "Argon2id",
    "iterations": 3,
    "memoryKiB": 65536,
    "parallelism": 1,
    "outputLength": 64,
    "version": "0x13",
    "salt": "base64url"
  },
  "cipher": {
    "name": "AES-GCM",
    "iv": "base64url",
    "ciphertext": "base64url"
  },
  "mac": {
    "name": "HMAC-SHA-256",
    "tag": "base64url"
  },
  "aad": "base64url"
}
```

`aad` is the serialized authenticated header and is used as AES-GCM additional authenticated data.

Supported KDF payloads for `kdf`:

- PBKDF2 profile
  - `name: "PBKDF2"`
  - `hash: "SHA-256"`
  - `iterations: number`
  - `salt: base64url`
- Argon2id profile
  - `name: "Argon2id"`
  - `version: "0x13"`
  - `iterations: number`
  - `memoryKiB: number`
  - `parallelism: number`
  - `outputLength: number`
  - `salt: base64url`

## 5. Algorithms

- KDF: PBKDF2-HMAC-SHA-256 or Argon2id
- Encryption: AES-256-GCM
- Integrity: HMAC-SHA-256 over `aad || ciphertext`
- Randomness: CSPRNG via Web Crypto `getRandomValues`

## 6. Key Derivation

1. Input: normalized passphrase and KDF profile parameters.
2. Derive key material with selected KDF profile.
  - PBKDF2 profile: 512 bits using PBKDF2-HMAC-SHA-256.
  - Argon2id profile: `outputLength` bytes (minimum 64 bytes).
3. Split into two 256-bit keys:
   - `encKey` for AES-GCM
   - `macKey` for HMAC

This split-key strategy prevents cryptographic key reuse across primitives.

## 7. Encryption Procedure

1. Canonicalize environment map.
2. Construct plaintext payload:
   - format identifier
   - generation timestamp
   - key-value map
3. Build authenticated header (`aad`) from immutable envelope fields.
4. Encrypt plaintext with AES-GCM using `encKey`, random IV, and `aad` as additional authenticated data.
5. Compute HMAC tag over `aad || ciphertext` using `macKey`.
6. Emit `SecretEnvelopeV1`.

## 8. Decryption Procedure

1. Validate envelope schema and version.
2. Recompute canonical `aad` from envelope fields and compare with provided `aad`.
3. Re-derive `encKey` and `macKey` from passphrase and KDF params.
4. Verify HMAC tag.
5. Decrypt AES-GCM with verified `aad`.
6. Parse and validate payload object.

Failure at any step must return a generic error and no plaintext.

## 9. Server Contract

- Server stores full envelope as opaque JSON.
- Server MUST NOT inspect plaintext fields.
- Server MUST NOT attempt decryption.
- Server MAY enforce TTL and one-time retrieval policy.

## 10. Versioning Rules

- `version` is required for every envelope.
- Any wire-format breaking change increments major protocol version.
- New optional fields are additive and must preserve backward compatibility.

## 11. Recommended Parameters (v1 defaults)

- PBKDF2 iterations: 210000
- Argon2id iterations (`t`): 3
- Argon2id memory (`m`): 65536 KiB (64 MiB)
- Argon2id parallelism (`p`): 1
- Argon2id output length: 64 bytes
- Salt length: 16 bytes
- AES-GCM IV length: 12 bytes
- HMAC tag length: 32 bytes
- Minimum passphrase length: 12 characters

## 12. Optional Asymmetric Transport Wrapper

`SecretEnvelopeV1` remains the canonical encrypted payload format. For recipient-style sharing, clients MAY wrap a serialized `SecretEnvelopeV1` using recipient public-key cryptography before transport:

- Generate random content-encryption key (CEK).
- Encrypt serialized envelope with AES-GCM using CEK.
- Encrypt CEK with recipient public key (RSA-OAEP-SHA-256 in v1 extension).
- Recipient decrypts CEK with private key and then decrypts wrapped envelope.

This wrapper is additive and does not alter server zero-knowledge behavior: the server still stores only opaque ciphertext blobs.

## 13. Future Extensions

- Argon2id KDF profile.
- Public-key recipient mode (ephemeral sender key + sealed content key).
- Detached signatures for auditable provenance.
