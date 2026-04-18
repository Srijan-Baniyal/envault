import { argon2idAsync } from "@noble/hashes/argon2.js";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToUtf8,
  joinBytes,
  utf8ToBytes,
} from "@/lib/crypto/encoding";
import { getRandomBytes, getSubtleCrypto } from "@/lib/crypto/runtime";
import {
  ARGON2ID_VERSION,
  ENVELOPE_VERSION,
  ENVIRONMENT_PAYLOAD_FORMAT,
  type EnvelopeArgon2idKdfParamsV1,
  type EnvelopePbkdf2KdfParamsV1,
  type EnvironmentPayloadV1,
  type SecretEnvelope,
  type SecretEnvelopeV1,
} from "@/lib/crypto/types";
import { assertSecretEnvelope } from "@/lib/crypto/validators";

const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 2_000_000;
const DEFAULT_ARGON2ID_ITERATIONS = 3;
const MIN_ARGON2ID_ITERATIONS = 1;
const MAX_ARGON2ID_ITERATIONS = 10;
const DEFAULT_ARGON2ID_MEMORY_KIB = 65_536;
const MIN_ARGON2ID_MEMORY_KIB = 8192;
const MAX_ARGON2ID_MEMORY_KIB = 1_048_576;
const DEFAULT_ARGON2ID_PARALLELISM = 1;
const MIN_ARGON2ID_PARALLELISM = 1;
const MAX_ARGON2ID_PARALLELISM = 16;
const DEFAULT_ARGON2ID_OUTPUT_LENGTH = 64;
const MIN_ARGON2ID_OUTPUT_LENGTH = 64;
const MAX_ARGON2ID_OUTPUT_LENGTH = 128;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const MIN_PASSPHRASE_LENGTH = 12;
const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const MAX_ENV_KEY_LENGTH = 128;
const MAX_ENV_VALUE_LENGTH = 16_384;

interface DerivedKeyPair {
  encryptionKey: CryptoKey;
  macKey: CryptoKey;
}

type ResolvedKdfProfile =
  | Omit<EnvelopePbkdf2KdfParamsV1, "salt">
  | Omit<EnvelopeArgon2idKdfParamsV1, "salt">;

interface Pbkdf2KdfSelection {
  iterations?: number;
  name?: "PBKDF2";
}

interface Argon2idKdfSelection {
  iterations?: number;
  memoryKiB?: number;
  name: "Argon2id";
  outputLength?: number;
  parallelism?: number;
}

export type KdfSelection = Pbkdf2KdfSelection | Argon2idKdfSelection;

export interface CreateEnvironmentEnvelopeOptions {
  iterations?: number;
  kdf?: KdfSelection;
  now?: () => Date;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePassphrase = (passphrase: string): string => {
  const normalized = passphrase.normalize("NFKC");
  if (normalized.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${String(MIN_PASSPHRASE_LENGTH)} characters.`
    );
  }
  return normalized;
};

const normalizeIterations = (iterations?: number): number => {
  if (iterations === undefined) {
    return DEFAULT_PBKDF2_ITERATIONS;
  }
  if (!Number.isInteger(iterations)) {
    throw new Error("PBKDF2 iterations must be an integer.");
  }
  if (
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error(
      `PBKDF2 iterations must be between ${String(MIN_PBKDF2_ITERATIONS)} and ${String(MAX_PBKDF2_ITERATIONS)}.`
    );
  }
  return iterations;
};

const normalizeArgon2idIterations = (iterations?: number): number => {
  if (iterations === undefined) {
    return DEFAULT_ARGON2ID_ITERATIONS;
  }

  if (!Number.isInteger(iterations)) {
    throw new Error("Argon2id iterations must be an integer.");
  }

  if (
    iterations < MIN_ARGON2ID_ITERATIONS ||
    iterations > MAX_ARGON2ID_ITERATIONS
  ) {
    throw new Error(
      `Argon2id iterations must be between ${String(MIN_ARGON2ID_ITERATIONS)} and ${String(MAX_ARGON2ID_ITERATIONS)}.`
    );
  }

  return iterations;
};

const normalizeArgon2idMemoryKiB = (memoryKiB?: number): number => {
  if (memoryKiB === undefined) {
    return DEFAULT_ARGON2ID_MEMORY_KIB;
  }

  if (!Number.isInteger(memoryKiB)) {
    throw new Error("Argon2id memoryKiB must be an integer.");
  }

  if (
    memoryKiB < MIN_ARGON2ID_MEMORY_KIB ||
    memoryKiB > MAX_ARGON2ID_MEMORY_KIB
  ) {
    throw new Error(
      `Argon2id memoryKiB must be between ${String(MIN_ARGON2ID_MEMORY_KIB)} and ${String(MAX_ARGON2ID_MEMORY_KIB)}.`
    );
  }

  return memoryKiB;
};

const normalizeArgon2idParallelism = (parallelism?: number): number => {
  if (parallelism === undefined) {
    return DEFAULT_ARGON2ID_PARALLELISM;
  }

  if (!Number.isInteger(parallelism)) {
    throw new Error("Argon2id parallelism must be an integer.");
  }

  if (
    parallelism < MIN_ARGON2ID_PARALLELISM ||
    parallelism > MAX_ARGON2ID_PARALLELISM
  ) {
    throw new Error(
      `Argon2id parallelism must be between ${String(MIN_ARGON2ID_PARALLELISM)} and ${String(MAX_ARGON2ID_PARALLELISM)}.`
    );
  }

  return parallelism;
};

const normalizeArgon2idOutputLength = (outputLength?: number): number => {
  if (outputLength === undefined) {
    return DEFAULT_ARGON2ID_OUTPUT_LENGTH;
  }

  if (!Number.isInteger(outputLength)) {
    throw new Error("Argon2id outputLength must be an integer.");
  }

  if (
    outputLength < MIN_ARGON2ID_OUTPUT_LENGTH ||
    outputLength > MAX_ARGON2ID_OUTPUT_LENGTH
  ) {
    throw new Error(
      `Argon2id outputLength must be between ${String(MIN_ARGON2ID_OUTPUT_LENGTH)} and ${String(MAX_ARGON2ID_OUTPUT_LENGTH)} bytes.`
    );
  }

  return outputLength;
};

const resolveKdfProfile = (
  options?: CreateEnvironmentEnvelopeOptions
): ResolvedKdfProfile => {
  const selectedName = options?.kdf?.name ?? "PBKDF2";

  if (selectedName === "PBKDF2") {
    const kdfIterations =
      options?.kdf?.name === "PBKDF2"
        ? options.kdf.iterations
        : options?.iterations;

    return {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: normalizeIterations(kdfIterations),
    };
  }

  const argonSelection = options?.kdf;
  if (!argonSelection || argonSelection.name !== "Argon2id") {
    throw new Error("Argon2id configuration is invalid.");
  }

  const iterations = normalizeArgon2idIterations(argonSelection.iterations);
  const parallelism = normalizeArgon2idParallelism(argonSelection.parallelism);
  const memoryKiB = normalizeArgon2idMemoryKiB(argonSelection.memoryKiB);
  const outputLength = normalizeArgon2idOutputLength(
    argonSelection.outputLength
  );

  if (memoryKiB < 8 * parallelism) {
    throw new Error("Argon2id memoryKiB must be at least 8 * parallelism.");
  }

  return {
    name: "Argon2id",
    version: ARGON2ID_VERSION,
    iterations,
    memoryKiB,
    parallelism,
    outputLength,
  };
};

const normalizeEnvironmentVariables = (
  variables: Record<string, string>
): Record<string, string> => {
  const normalizedEntries = Object.entries(variables).toSorted(
    ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)
  );

  const normalized: Record<string, string> = {};

  for (const [key, value] of normalizedEntries) {
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new Error(`Environment key "${key}" is invalid.`);
    }
    if (key.length > MAX_ENV_KEY_LENGTH) {
      throw new Error(`Environment key "${key}" exceeds maximum length.`);
    }
    if (value.length > MAX_ENV_VALUE_LENGTH) {
      throw new Error(`Environment value for "${key}" exceeds maximum length.`);
    }
    normalized[key] = value;
  }

  return normalized;
};

const buildAssociatedDataBytes = (
  envelope: Pick<SecretEnvelopeV1, "version" | "createdAt" | "kdf" | "cipher">
): Uint8Array => {
  const kdfPayload =
    envelope.kdf.name === "PBKDF2"
      ? {
          name: envelope.kdf.name,
          hash: envelope.kdf.hash,
          iterations: envelope.kdf.iterations,
          salt: envelope.kdf.salt,
        }
      : {
          name: envelope.kdf.name,
          version: envelope.kdf.version,
          iterations: envelope.kdf.iterations,
          memoryKiB: envelope.kdf.memoryKiB,
          parallelism: envelope.kdf.parallelism,
          outputLength: envelope.kdf.outputLength,
          salt: envelope.kdf.salt,
        };

  const aadPayload = {
    version: envelope.version,
    createdAt: envelope.createdAt,
    kdf: kdfPayload,
    cipher: {
      name: envelope.cipher.name,
      iv: envelope.cipher.iv,
    },
  };

  return utf8ToBytes(JSON.stringify(aadPayload));
};

const deriveKeyPair = async (
  passphrase: string,
  salt: Uint8Array,
  kdf: SecretEnvelopeV1["kdf"]
): Promise<DerivedKeyPair> => {
  const subtle = getSubtleCrypto();
  const passphraseBytes = utf8ToBytes(passphrase);

  let derivedBytes: Uint8Array;

  if (kdf.name === "PBKDF2") {
    const pbkdf2Key = await subtle.importKey(
      "raw",
      passphraseBytes,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: kdf.iterations,
      },
      pbkdf2Key,
      512
    );

    derivedBytes = new Uint8Array(derivedBits);
  } else {
    derivedBytes = await argon2idAsync(passphraseBytes, salt, {
      version: 0x13,
      t: kdf.iterations,
      m: kdf.memoryKiB,
      p: kdf.parallelism,
      dkLen: kdf.outputLength,
    });
  }

  const encryptionMaterial = derivedBytes.slice(0, 32);
  const macMaterial = derivedBytes.slice(32, 64);

  const encryptionKey = await subtle.importKey(
    "raw",
    encryptionMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  const macKey = await subtle.importKey(
    "raw",
    macMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  return { encryptionKey, macKey };
};

const parseEnvironmentPayload = (value: string): EnvironmentPayloadV1 => {
  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed) || parsed.format !== ENVIRONMENT_PAYLOAD_FORMAT) {
    throw new Error("Decrypted payload format is invalid.");
  }

  if (
    typeof parsed.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.generatedAt))
  ) {
    throw new Error("Decrypted payload timestamp is invalid.");
  }

  if (!isRecord(parsed.variables)) {
    throw new Error("Decrypted payload variables are invalid.");
  }

  const variables: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(parsed.variables)) {
    if (typeof rawValue !== "string") {
      throw new Error("Decrypted payload has non-string environment values.");
    }
    variables[key] = rawValue;
  }

  return {
    format: ENVIRONMENT_PAYLOAD_FORMAT,
    generatedAt: parsed.generatedAt,
    variables,
  };
};

export const createEnvironmentEnvelope = async (
  variables: Record<string, string>,
  passphrase: string,
  options?: CreateEnvironmentEnvelopeOptions
): Promise<SecretEnvelope> => {
  const normalizedVariables = normalizeEnvironmentVariables(variables);
  const normalizedPassphrase = normalizePassphrase(passphrase);
  const kdfProfile = resolveKdfProfile(options);
  const now = options?.now ?? (() => new Date());

  const createdAt = now().toISOString();
  const salt = getRandomBytes(SALT_LENGTH_BYTES);
  const iv = getRandomBytes(IV_LENGTH_BYTES);

  const saltEncoded = bytesToBase64Url(salt);
  const ivEncoded = bytesToBase64Url(iv);

  const envelopeTemplate: Pick<
    SecretEnvelopeV1,
    "version" | "createdAt" | "kdf" | "cipher"
  > = {
    version: ENVELOPE_VERSION,
    createdAt,
    kdf:
      kdfProfile.name === "PBKDF2"
        ? {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: kdfProfile.iterations,
            salt: saltEncoded,
          }
        : {
            name: "Argon2id",
            version: ARGON2ID_VERSION,
            iterations: kdfProfile.iterations,
            memoryKiB: kdfProfile.memoryKiB,
            parallelism: kdfProfile.parallelism,
            outputLength: kdfProfile.outputLength,
            salt: saltEncoded,
          },
    cipher: {
      name: "AES-GCM",
      iv: ivEncoded,
      ciphertext: "",
    },
  };

  const associatedDataBytes = buildAssociatedDataBytes(envelopeTemplate);
  const associatedData = bytesToBase64Url(associatedDataBytes);

  const payload: EnvironmentPayloadV1 = {
    format: ENVIRONMENT_PAYLOAD_FORMAT,
    generatedAt: createdAt,
    variables: normalizedVariables,
  };

  const plaintextBytes = utf8ToBytes(JSON.stringify(payload));
  const subtle = getSubtleCrypto();
  const { encryptionKey, macKey } = await deriveKeyPair(
    normalizedPassphrase,
    salt,
    envelopeTemplate.kdf
  );

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: associatedDataBytes,
      tagLength: 128,
    },
    encryptionKey,
    plaintextBytes
  );
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  const macInput = joinBytes(associatedDataBytes, ciphertextBytes);
  const macBuffer = await subtle.sign("HMAC", macKey, macInput);
  const macBytes = new Uint8Array(macBuffer);

  return {
    version: ENVELOPE_VERSION,
    createdAt,
    kdf: envelopeTemplate.kdf,
    cipher: {
      name: "AES-GCM",
      iv: ivEncoded,
      ciphertext: bytesToBase64Url(ciphertextBytes),
    },
    mac: {
      name: "HMAC-SHA-256",
      tag: bytesToBase64Url(macBytes),
    },
    aad: associatedData,
  };
};

export const openEnvironmentEnvelope = async (
  envelopeInput: SecretEnvelope,
  passphrase: string
): Promise<Record<string, string>> => {
  assertSecretEnvelope(envelopeInput);

  const normalizedPassphrase = normalizePassphrase(passphrase);

  if (envelopeInput.version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: ${envelopeInput.version}.`);
  }

  const expectedAssociatedDataBytes = buildAssociatedDataBytes(envelopeInput);
  const expectedAssociatedData = bytesToBase64Url(expectedAssociatedDataBytes);
  if (expectedAssociatedData !== envelopeInput.aad) {
    throw new Error(
      "Envelope associated data does not match payload metadata."
    );
  }

  const saltBytes = base64UrlToBytes(envelopeInput.kdf.salt);
  const ivBytes = base64UrlToBytes(envelopeInput.cipher.iv);
  const ciphertextBytes = base64UrlToBytes(envelopeInput.cipher.ciphertext);
  const tagBytes = base64UrlToBytes(envelopeInput.mac.tag);

  const subtle = getSubtleCrypto();
  const { encryptionKey, macKey } = await deriveKeyPair(
    normalizedPassphrase,
    saltBytes,
    envelopeInput.kdf
  );

  const verified = await subtle.verify(
    "HMAC",
    macKey,
    tagBytes,
    joinBytes(expectedAssociatedDataBytes, ciphertextBytes)
  );

  if (!verified) {
    throw new Error("Envelope MAC verification failed.");
  }

  let plaintextBytes: Uint8Array;
  try {
    const plaintextBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        additionalData: expectedAssociatedDataBytes,
        tagLength: 128,
      },
      encryptionKey,
      ciphertextBytes
    );
    plaintextBytes = new Uint8Array(plaintextBuffer);
  } catch {
    throw new Error("Unable to decrypt envelope. Data may be corrupted.");
  }

  const payload = parseEnvironmentPayload(bytesToUtf8(plaintextBytes));
  return payload.variables;
};
