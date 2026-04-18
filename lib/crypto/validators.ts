import type { SecretEnvelope } from "@/lib/crypto/types";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBase64UrlString = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  BASE64URL_PATTERN.test(value);

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && typeof value === "number" && value > 0;

const isArgon2idKdf = (value: Record<string, unknown>): boolean =>
  value.name === "Argon2id" &&
  value.version === "0x13" &&
  isPositiveInteger(value.iterations) &&
  isPositiveInteger(value.memoryKiB) &&
  isPositiveInteger(value.parallelism) &&
  isPositiveInteger(value.outputLength) &&
  typeof value.outputLength === "number" &&
  value.outputLength >= 64 &&
  isBase64UrlString(value.salt);

const isPbkdf2Kdf = (value: Record<string, unknown>): boolean =>
  value.name === "PBKDF2" &&
  value.hash === "SHA-256" &&
  isPositiveInteger(value.iterations) &&
  isBase64UrlString(value.salt);

const hasValidDate = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  return Number.isFinite(Date.parse(value));
};

export const isSecretEnvelope = (value: unknown): value is SecretEnvelope => {
  if (!isRecord(value)) {
    return false;
  }

  const kdf = value.kdf;
  const cipher = value.cipher;
  const mac = value.mac;

  if (!(isRecord(kdf) && isRecord(cipher) && isRecord(mac))) {
    return false;
  }

  return (
    value.version === "shareenv.v1" &&
    hasValidDate(value.createdAt) &&
    isBase64UrlString(value.aad) &&
    (isPbkdf2Kdf(kdf) || isArgon2idKdf(kdf)) &&
    cipher.name === "AES-GCM" &&
    isBase64UrlString(cipher.iv) &&
    isBase64UrlString(cipher.ciphertext) &&
    mac.name === "HMAC-SHA-256" &&
    isBase64UrlString(mac.tag)
  );
};

export const assertSecretEnvelope = (
  value: unknown
): asserts value is SecretEnvelope => {
  if (!isSecretEnvelope(value)) {
    throw new Error("Invalid secret envelope payload.");
  }
};
