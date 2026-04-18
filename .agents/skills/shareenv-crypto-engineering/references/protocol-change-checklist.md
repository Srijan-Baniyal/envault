# Protocol Change Checklist

Use this checklist before merging protocol-affecting changes.

## Envelope Semantics

- [ ] `version` impact evaluated.
- [ ] Additive vs breaking change classified.
- [ ] Backward compatibility path documented.

## Cryptographic Controls

- [ ] KDF parameters reviewed and justified.
- [ ] Encryption mode and nonce strategy reviewed.
- [ ] MAC coverage includes all critical metadata.
- [ ] No key reuse across different primitives.

## Zero-Knowledge Guarantees

- [ ] Server code does not decrypt payloads.
- [ ] Server logs do not include plaintext or passphrase.
- [ ] New metadata fields do not leak secret context.

## Validation and Failure Handling

- [ ] Schema validation rejects malformed envelopes.
- [ ] Tampered envelope fails before decrypt.
- [ ] Wrong-passphrase behavior does not leak oracle details.

## Documentation

- [ ] `docs/protocol/spec.md` updated.
- [ ] `docs/security/threat-model.md` updated.
- [ ] `docs/engineering/roadmap.md` updated if migration implications exist.
