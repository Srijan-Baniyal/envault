import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToUtf8,
  utf8ToBytes,
} from "@/lib/crypto/encoding";
import { getRandomBytes, getSubtleCrypto } from "@/lib/crypto/runtime";
import type { SecretEnvelope } from "@/lib/crypto/types";
import { assertSecretEnvelope } from "@/lib/crypto/validators";

const WRAPPED_ENVELOPE_VERSION = "shareenv.wrapped.v1" as const;
const WRAPPED_ENVELOPE_ALGORITHM = "RSA-OAEP-SHA-256+AES-256-GCM" as const;
const CONTENT_KEY_LENGTH_BYTES = 32;
const WRAPPED_IV_LENGTH_BYTES = 12;

export interface EnvelopeRecipientKeyPair {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
}

export interface WrappedSecretEnvelopeV1 {
  algorithm: typeof WRAPPED_ENVELOPE_ALGORITHM;
  ciphertext: string;
  iv: string;
  version: typeof WRAPPED_ENVELOPE_VERSION;
  wrappedKey: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const isBase64UrlString = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  BASE64URL_PATTERN.test(value);

export const assertWrappedSecretEnvelope = (
  value: unknown
): asserts value is WrappedSecretEnvelopeV1 => {
  if (!isRecord(value)) {
    throw new Error("Wrapped envelope payload must be an object.");
  }

  if (value.version !== WRAPPED_ENVELOPE_VERSION) {
    throw new Error("Unsupported wrapped envelope version.");
  }

  if (value.algorithm !== WRAPPED_ENVELOPE_ALGORITHM) {
    throw new Error("Unsupported wrapped envelope algorithm.");
  }

  if (!isBase64UrlString(value.wrappedKey)) {
    throw new Error("Wrapped envelope key is invalid.");
  }

  if (!isBase64UrlString(value.iv)) {
    throw new Error("Wrapped envelope IV is invalid.");
  }

  if (!isBase64UrlString(value.ciphertext)) {
    throw new Error("Wrapped envelope ciphertext is invalid.");
  }
};

export const generateEnvelopeRecipientKeyPair =
  async (): Promise<EnvelopeRecipientKeyPair> => {
    const subtle = getSubtleCrypto();
    const keyPair = await subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 3072,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const [publicKeyJwk, privateKeyJwk] = await Promise.all([
      subtle.exportKey("jwk", keyPair.publicKey),
      subtle.exportKey("jwk", keyPair.privateKey),
    ]);

    return { publicKeyJwk, privateKeyJwk };
  };

export const wrapEnvelopeWithRecipientPublicKey = async (
  envelope: SecretEnvelope,
  recipientPublicKeyJwk: JsonWebKey
): Promise<WrappedSecretEnvelopeV1> => {
  assertSecretEnvelope(envelope);

  const subtle = getSubtleCrypto();
  const recipientPublicKey = await subtle.importKey(
    "jwk",
    recipientPublicKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"]
  );

  const contentEncryptionKey = getRandomBytes(CONTENT_KEY_LENGTH_BYTES);
  const iv = getRandomBytes(WRAPPED_IV_LENGTH_BYTES);

  const aesKey = await subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const envelopeBytes = utf8ToBytes(JSON.stringify(envelope));
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    aesKey,
    envelopeBytes
  );

  const wrappedKeyBuffer = await subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    contentEncryptionKey
  );

  return {
    version: WRAPPED_ENVELOPE_VERSION,
    algorithm: WRAPPED_ENVELOPE_ALGORITHM,
    wrappedKey: bytesToBase64Url(new Uint8Array(wrappedKeyBuffer)),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertextBuffer)),
  };
};

export const unwrapEnvelopeWithRecipientPrivateKey = async (
  wrappedEnvelopeInput: WrappedSecretEnvelopeV1,
  recipientPrivateKeyJwk: JsonWebKey
): Promise<SecretEnvelope> => {
  assertWrappedSecretEnvelope(wrappedEnvelopeInput);

  const subtle = getSubtleCrypto();
  const recipientPrivateKey = await subtle.importKey(
    "jwk",
    recipientPrivateKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"]
  );

  const decryptedContentKeyBuffer = await subtle.decrypt(
    { name: "RSA-OAEP" },
    recipientPrivateKey,
    base64UrlToBytes(wrappedEnvelopeInput.wrappedKey)
  );

  const decryptedContentKey = new Uint8Array(decryptedContentKeyBuffer);
  if (decryptedContentKey.length !== CONTENT_KEY_LENGTH_BYTES) {
    throw new Error("Wrapped envelope content key has invalid length.");
  }

  const aesKey = await subtle.importKey(
    "raw",
    decryptedContentKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const plaintextBuffer = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(wrappedEnvelopeInput.iv),
      tagLength: 128,
    },
    aesKey,
    base64UrlToBytes(wrappedEnvelopeInput.ciphertext)
  );

  const envelopeCandidate = JSON.parse(
    bytesToUtf8(new Uint8Array(plaintextBuffer))
  ) as unknown;
  assertSecretEnvelope(envelopeCandidate);

  return envelopeCandidate;
};
