export const ENVELOPE_VERSION = "shareenv.v1" as const;
export const ENVIRONMENT_PAYLOAD_FORMAT = "shareenv.environment.v1" as const;

export const ARGON2ID_VERSION = "0x13" as const;

export interface EnvelopePbkdf2KdfParamsV1 {
  hash: "SHA-256";
  iterations: number;
  name: "PBKDF2";
  salt: string;
}

export interface EnvelopeArgon2idKdfParamsV1 {
  iterations: number;
  memoryKiB: number;
  name: "Argon2id";
  outputLength: number;
  parallelism: number;
  salt: string;
  version: typeof ARGON2ID_VERSION;
}

export type EnvelopeKdfParamsV1 =
  | EnvelopePbkdf2KdfParamsV1
  | EnvelopeArgon2idKdfParamsV1;

export interface EnvelopeCipherParamsV1 {
  ciphertext: string;
  iv: string;
  name: "AES-GCM";
}

export interface EnvelopeMacParamsV1 {
  name: "HMAC-SHA-256";
  tag: string;
}

export interface SecretEnvelopeV1 {
  aad: string;
  cipher: EnvelopeCipherParamsV1;
  createdAt: string;
  kdf: EnvelopeKdfParamsV1;
  mac: EnvelopeMacParamsV1;
  version: typeof ENVELOPE_VERSION;
}

export type SecretEnvelope = SecretEnvelopeV1;

export interface EnvironmentPayloadV1 {
  format: typeof ENVIRONMENT_PAYLOAD_FORMAT;
  generatedAt: string;
  variables: Record<string, string>;
}
