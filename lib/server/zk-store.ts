import "server-only";

import type { SecretEnvelope } from "@/lib/crypto/types";

const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

export interface StoredEnvelopeRecord {
  accessCount: number;
  createdAt: string;
  envelope: SecretEnvelope;
  expiresAt: string | null;
  id: string;
  oneTime: boolean;
}

export interface StoredEnvelopeSummary {
  accessCount: number;
  createdAt: string;
  expiresAt: string | null;
  id: string;
  oneTime: boolean;
}

export interface CreateStoredEnvelopeInput {
  envelope: SecretEnvelope;
  oneTime?: boolean;
  ttlSeconds?: number;
}

const store = new Map<string, StoredEnvelopeRecord>();

const cloneEnvelope = (envelope: SecretEnvelope): SecretEnvelope =>
  JSON.parse(JSON.stringify(envelope)) as SecretEnvelope;

const cloneRecord = (record: StoredEnvelopeRecord): StoredEnvelopeRecord => ({
  ...record,
  envelope: cloneEnvelope(record.envelope),
});

const toSummary = (record: StoredEnvelopeRecord): StoredEnvelopeSummary => ({
  accessCount: record.accessCount,
  createdAt: record.createdAt,
  expiresAt: record.expiresAt,
  id: record.id,
  oneTime: record.oneTime,
});

const now = (): Date => new Date();

const createId = (): string => {
  const runtimeCrypto = globalThis.crypto;

  if (runtimeCrypto?.randomUUID) {
    return runtimeCrypto.randomUUID();
  }

  if (!runtimeCrypto?.getRandomValues) {
    throw new Error("Secure random generator is unavailable in this runtime.");
  }

  const bytes = new Uint8Array(16);
  runtimeCrypto.getRandomValues(bytes);

  const asHex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  return `${asHex.slice(0, 8)}-${asHex.slice(8, 12)}-${asHex.slice(12, 16)}-${asHex.slice(16, 20)}-${asHex.slice(20, 32)}`;
};

const resolveExpiresAt = (ttlSeconds?: number): string | null => {
  if (ttlSeconds === undefined) {
    const expiresAt = new Date(now().getTime() + DEFAULT_TTL_SECONDS * 1000);
    return expiresAt.toISOString();
  }

  if (!Number.isInteger(ttlSeconds)) {
    throw new Error("ttlSeconds must be an integer.");
  }

  if (ttlSeconds === 0) {
    return null;
  }

  if (ttlSeconds < 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error(
      `ttlSeconds must be between 0 and ${String(MAX_TTL_SECONDS)}.`
    );
  }

  const expiresAt = new Date(now().getTime() + ttlSeconds * 1000);
  return expiresAt.toISOString();
};

const isExpired = (record: StoredEnvelopeRecord): boolean => {
  if (!record.expiresAt) {
    return false;
  }
  return Date.parse(record.expiresAt) <= now().getTime();
};

const pruneExpired = (): void => {
  for (const [id, record] of store.entries()) {
    if (isExpired(record)) {
      store.delete(id);
    }
  }
};

export const createStoredEnvelope = (
  input: CreateStoredEnvelopeInput
): StoredEnvelopeRecord => {
  pruneExpired();

  const id = createId();
  const createdAt = now().toISOString();
  const expiresAt = resolveExpiresAt(input.ttlSeconds);

  const record: StoredEnvelopeRecord = {
    id,
    envelope: cloneEnvelope(input.envelope),
    createdAt,
    expiresAt,
    oneTime: input.oneTime ?? true,
    accessCount: 0,
  };

  store.set(id, record);
  return cloneRecord(record);
};

export const consumeEnvelopeById = (
  id: string
): StoredEnvelopeRecord | null => {
  pruneExpired();

  const record = store.get(id);
  if (!record) {
    return null;
  }

  const updatedRecord: StoredEnvelopeRecord = {
    ...record,
    accessCount: record.accessCount + 1,
  };

  if (updatedRecord.oneTime) {
    store.delete(id);
  } else {
    store.set(id, updatedRecord);
  }

  return cloneRecord(updatedRecord);
};

export const deleteEnvelopeById = (id: string): boolean => {
  pruneExpired();
  return store.delete(id);
};

export const getStoreStats = (): { activeRecords: number } => {
  pruneExpired();
  return { activeRecords: store.size };
};

export const listEnvelopeSummaries = (options?: {
  limit?: number;
}): StoredEnvelopeSummary[] => {
  pruneExpired();

  const limit = options?.limit ?? 20;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Summary limit must be a positive integer.");
  }

  return Array.from(store.values())
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map(toSummary);
};

export const getStoreDefaults = (): {
  defaultTtlSeconds: number;
  maxTtlSeconds: number;
  oneTimeByDefault: boolean;
} => ({
  defaultTtlSeconds: DEFAULT_TTL_SECONDS,
  maxTtlSeconds: MAX_TTL_SECONDS,
  oneTimeByDefault: true,
});
