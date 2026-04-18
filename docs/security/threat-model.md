# ShareEnv Threat Model (v1)

## 1. Assets

- Environment variable plaintext values.
- User passphrases.
- Envelope integrity guarantees.
- Availability of encrypted envelopes.

## 2. Trust Boundaries

- Trusted: local client runtime executing encryption/decryption.
- Untrusted: network transport, server storage, logs, and infra operators.
- Semi-trusted: browser runtime extensions and local machine posture.

## 3. Adversaries

- Passive network observer.
- Active network attacker (replay/tamper).
- Malicious or compromised server operator.
- Offline attacker with stolen encrypted envelopes.

## 4. Security Assumptions

- Web Crypto primitives are correctly implemented by runtime.
- Random generator is cryptographically strong.
- Users pick passphrases with sufficient entropy.

## 5. Threats and Mitigations

## 5.1 Server data breach

Threat: attacker exfiltrates envelope database.

Mitigations:
- Envelope payloads are encrypted client-side using AES-GCM.
- No plaintext secrets or passphrases are stored server-side.
- HMAC prevents undetected tampering with stored ciphertext.

Residual risk:
- Offline dictionary attacks remain possible against weak passphrases.

## 5.2 Network interception / tampering

Threat: MITM modifies envelope response or request.

Mitigations:
- MAC verification on client rejects modified data.
- AES-GCM additional authenticated data binds metadata to ciphertext.
- HTTPS is still required to reduce traffic analysis and active disruption.

## 5.3 Replay of old envelopes

Threat: attacker replays stale but valid ciphertext.

Mitigations:
- Optional one-time retrieval mode.
- Optional TTL expiration.
- Client can enforce freshness checks using `createdAt`.

## 5.4 Metadata leakage

Threat: envelope metadata reveals usage patterns.

Mitigations:
- Keep metadata minimal.
- Avoid putting usernames, project names, or secret identifiers in stored labels.

Residual risk:
- Envelope size, creation time, and access timing are observable by server.

## 5.5 Weak passphrases

Threat: brute-force passphrase recovery offline.

Mitigations:
- PBKDF2 work factor (210000) slows guessing.
- Argon2id profile provides memory-hard brute-force resistance.
- Enforce minimum passphrase length in client validation.
- Recommend password manager-generated high-entropy passphrases.

Residual risk:
- PBKDF2 profile remains more GPU-friendly than Argon2id profile.

## 5.7 Asymmetric key handling mistakes

Threat: recipient private-key leakage or incorrect key wrapping configuration.

Mitigations:
- Use RSA-OAEP-SHA-256 for CEK wrapping.
- Keep private key operations client-side only.
- Treat wrapped envelope blobs as opaque server payloads.

Residual risk:
- Compromised private keys allow envelope recovery for targeted wrapped envelopes.

## 5.6 Malicious client code injection

Threat: XSS or supply-chain attack steals passphrase before encryption.

Mitigations:
- Strict CSP and dependency hygiene.
- Runtime integrity checks and CI lockfile policy.
- Security review gates before release.

Residual risk:
- If runtime is compromised, cryptography cannot protect input capture.

## 6. Security Invariants

- Plaintext secrets must never be transmitted to server.
- Passphrase must never be transmitted to server.
- Any ciphertext tampering must be detectable before decrypt.
- Decryption failures must not leak oracle details.

## 7. Operational Controls

- Keep API logs free from request body capture.
- Rate-limit envelope creation/fetch endpoints.
- Use short default TTL for sensitive exchanges.
- Run dependency and secret scanning in CI.

## 8. Planned Hardening (v2)

- Add per-envelope nonce misuse detection telemetry.
- Add signed server receipts for audit chains without breaking zero-knowledge property.
