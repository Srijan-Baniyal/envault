import "server-only";

import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { SecretEnvelope } from "@/lib/crypto/types";
import { isSecretEnvelope } from "@/lib/crypto/validators";

const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

const DEFAULT_STORE_FILE_PATH = join(
  process.cwd(),
  ".shareenv",
  "zk-store.json"
);

const FALLBACK_STORE_FILE_PATH = join(tmpdir(), "shareenv", "zk-store.json");

const resolveStoreFilePath = (): string => {
  if (process.env.SHAREENV_STORE_FILE_PATH) {
    return process.env.SHAREENV_STORE_FILE_PATH;
  }

  try {
    accessSync(process.cwd(), constants.W_OK);
    return DEFAULT_STORE_FILE_PATH;
  } catch {
    // Serverless bundles (e.g. /var/task) are read-only; /tmp is writable.
    return FALLBACK_STORE_FILE_PATH;
  }
};

const STORE_FILE_PATH = resolveStoreFilePath();

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

const isStoredEnvelopeRecord = (
  value: unknown
): value is StoredEnvelopeRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<StoredEnvelopeRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    (record.expiresAt === null || typeof record.expiresAt === "string") &&
    typeof record.oneTime === "boolean" &&
    Number.isInteger(record.accessCount) &&
    (record.accessCount ?? 0) >= 0 &&
    isSecretEnvelope(record.envelope)
  );
};

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

const pruneExpired = (records: Map<string, StoredEnvelopeRecord>): void => {
  for (const [id, record] of records.entries()) {
    if (isExpired(record)) {
      records.delete(id);
    }
  }
};

const readStore = (): Map<string, StoredEnvelopeRecord> => {
  try {
    const rawStoreData = readFileSync(STORE_FILE_PATH, "utf8");
    const parsed = JSON.parse(rawStoreData) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Envelope store file must contain an array.");
    }

    const records = new Map<string, StoredEnvelopeRecord>();

    for (const entry of parsed) {
      if (!isStoredEnvelopeRecord(entry)) {
        throw new Error("Envelope store contains an invalid record.");
      }

      records.set(entry.id, cloneRecord(entry));
    }

    return records;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map<string, StoredEnvelopeRecord>();
    }

    const message =
      error instanceof Error ? error.message : "Unknown storage error.";

    throw new Error(`Unable to read envelope store: ${message}`);
  }
};

const writeStore = (records: Map<string, StoredEnvelopeRecord>): void => {
  const outputRecords = Array.from(records.values(), (record) =>
    cloneRecord(record)
  );

  mkdirSync(dirname(STORE_FILE_PATH), { recursive: true });

  const tempPath = `${STORE_FILE_PATH}.${process.pid}.${String(Date.now())}.tmp`;

  writeFileSync(tempPath, JSON.stringify(outputRecords), "utf8");
  renameSync(tempPath, STORE_FILE_PATH);
};

const withStore = <T>(
  operation: (records: Map<string, StoredEnvelopeRecord>) => T
): T => {
  const records = readStore();
  pruneExpired(records);

  const result = operation(records);

  pruneExpired(records);
  writeStore(records);

  return result;
};

export const createStoredEnvelope = (
  input: CreateStoredEnvelopeInput
): StoredEnvelopeRecord =>
  withStore((records) => {
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

    records.set(id, record);

    return cloneRecord(record);
  });

export const consumeEnvelopeById = (id: string): StoredEnvelopeRecord | null =>
  withStore((records) => {
    const record = records.get(id);
    if (!record) {
      return null;
    }

    const updatedRecord: StoredEnvelopeRecord = {
      ...record,
      accessCount: record.accessCount + 1,
    };

    if (updatedRecord.oneTime) {
      records.delete(id);
    } else {
      records.set(id, updatedRecord);
    }

    return cloneRecord(updatedRecord);
  });

export const deleteEnvelopeById = (id: string): boolean =>
  withStore((records) => records.delete(id));

export const getStoreStats = (): { activeRecords: number } =>
  withStore((records) => ({ activeRecords: records.size }));

export const listEnvelopeSummaries = (options?: {
  limit?: number;
}): StoredEnvelopeSummary[] =>
  withStore((records) => {
    const limit = options?.limit ?? 20;

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Summary limit must be a positive integer.");
    }

    return Array.from(records.values())
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map(toSummary);
  });

export const getStoreDefaults = (): {
  defaultTtlSeconds: number;
  maxTtlSeconds: number;
  oneTimeByDefault: boolean;
} => ({
  defaultTtlSeconds: DEFAULT_TTL_SECONDS,
  maxTtlSeconds: MAX_TTL_SECONDS,
  oneTimeByDefault: true,
});
