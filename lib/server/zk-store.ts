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
import { Redis } from "@upstash/redis";

import type { SecretEnvelope } from "@/lib/crypto/types";
import { isSecretEnvelope } from "@/lib/crypto/validators";

const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

const REDIS_REST_URL =
  process.env.SHAREENV_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.UPSTASH_REDIS_REST_URL;

const REDIS_REST_TOKEN =
  process.env.SHAREENV_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.UPSTASH_REDIS_REST_TOKEN;

const REDIS_KEY_PREFIX = process.env.SHAREENV_REDIS_KEY_PREFIX ?? "shareenv";
const REDIS_INDEX_KEY = `${REDIS_KEY_PREFIX}:envelopes:index`;

const DEFAULT_STORE_FILE_PATH = join(
  process.cwd(),
  ".shareenv",
  "zk-store.json"
);

const FALLBACK_STORE_FILE_PATH = join(tmpdir(), "shareenv", "zk-store.json");

const createRedisClient = (): Redis | null => {
  const hasRedisUrl =
    typeof REDIS_REST_URL === "string" && REDIS_REST_URL.length > 0;
  const hasRedisToken =
    typeof REDIS_REST_TOKEN === "string" && REDIS_REST_TOKEN.length > 0;

  if (hasRedisUrl !== hasRedisToken) {
    throw new Error(
      "Both SHAREENV_REDIS_REST_URL and SHAREENV_REDIS_REST_TOKEN must be set when enabling Redis storage."
    );
  }

  if (!(hasRedisUrl && hasRedisToken)) {
    return null;
  }

  return new Redis({
    url: REDIS_REST_URL,
    token: REDIS_REST_TOKEN,
  });
};

const REDIS_CLIENT = createRedisClient();
const redisEnvelopeKey = (id: string): string =>
  `${REDIS_KEY_PREFIX}:envelope:${id}`;

const assertStoreConfiguration = (): void => {
  const isProduction = process.env.NODE_ENV === "production";
  const isServerlessRuntime =
    process.env.VERCEL === "1" ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === "string";
  const hasFileStoreOverride =
    typeof process.env.SHAREENV_STORE_FILE_PATH === "string" &&
    process.env.SHAREENV_STORE_FILE_PATH.length > 0;

  if (
    isProduction &&
    isServerlessRuntime &&
    !REDIS_CLIENT &&
    !hasFileStoreOverride
  ) {
    throw new Error(
      "Shared Redis storage is required in serverless production. Set SHAREENV_REDIS_REST_URL and SHAREENV_REDIS_REST_TOKEN (or KV/UPSTASH equivalents)."
    );
  }
};

assertStoreConfiguration();

const resolveStoreFilePath = (): string => {
  if (REDIS_CLIENT) {
    return DEFAULT_STORE_FILE_PATH;
  }

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

const ttlSecondsFromExpiresAt = (expiresAt: string | null): number | null => {
  if (!expiresAt) {
    return null;
  }

  const millisecondsUntilExpiry = Date.parse(expiresAt) - now().getTime();
  if (millisecondsUntilExpiry <= 0) {
    return 0;
  }

  return Math.ceil(millisecondsUntilExpiry / 1000);
};

const parseStoredEnvelopeRecord = (
  value: unknown,
  id: string
): StoredEnvelopeRecord => {
  let candidate = value;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      throw new Error(`Envelope store contains invalid JSON for id ${id}.`);
    }
  }

  if (!isStoredEnvelopeRecord(candidate)) {
    throw new Error(`Envelope store contains an invalid record for id ${id}.`);
  }

  return cloneRecord(candidate);
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

const deleteRedisRecordById = async (id: string): Promise<void> => {
  if (!REDIS_CLIENT) {
    return;
  }

  await Promise.all([
    REDIS_CLIENT.del(redisEnvelopeKey(id)),
    REDIS_CLIENT.zrem(REDIS_INDEX_KEY, id),
  ]);
};

const loadRedisRecordById = async (
  id: string
): Promise<StoredEnvelopeRecord | null> => {
  if (!REDIS_CLIENT) {
    return null;
  }

  const payload = await REDIS_CLIENT.get<unknown>(redisEnvelopeKey(id));
  if (payload === null) {
    await REDIS_CLIENT.zrem(REDIS_INDEX_KEY, id);
    return null;
  }

  const record = parseStoredEnvelopeRecord(payload, id);
  if (isExpired(record)) {
    await deleteRedisRecordById(id);
    return null;
  }

  return record;
};

const persistRedisRecord = async (
  record: StoredEnvelopeRecord
): Promise<void> => {
  if (!REDIS_CLIENT) {
    return;
  }

  const serializedRecord = JSON.stringify(cloneRecord(record));
  const ttlSeconds = ttlSecondsFromExpiresAt(record.expiresAt);

  if (ttlSeconds === null) {
    await REDIS_CLIENT.set(redisEnvelopeKey(record.id), serializedRecord);
  } else {
    if (ttlSeconds <= 0) {
      await deleteRedisRecordById(record.id);
      return;
    }

    await REDIS_CLIENT.set(redisEnvelopeKey(record.id), serializedRecord, {
      ex: ttlSeconds,
    });
  }

  await REDIS_CLIENT.zadd(REDIS_INDEX_KEY, {
    score: Date.parse(record.createdAt),
    member: record.id,
  });
};

const listRedisRecords = async (
  limit: number
): Promise<StoredEnvelopeRecord[]> => {
  if (!REDIS_CLIENT) {
    return [];
  }

  const ids = await REDIS_CLIENT.zrange<string[]>(REDIS_INDEX_KEY, 0, -1, {
    rev: true,
  });

  const records: StoredEnvelopeRecord[] = [];

  for (const id of ids) {
    if (records.length >= limit) {
      break;
    }

    const record = await loadRedisRecordById(id);
    if (record) {
      records.push(record);
    }
  }

  return records;
};

const countRedisRecords = async (): Promise<number> => {
  if (!REDIS_CLIENT) {
    return 0;
  }

  const ids = await REDIS_CLIENT.zrange<string[]>(REDIS_INDEX_KEY, 0, -1);
  let activeRecords = 0;

  for (const id of ids) {
    const record = await loadRedisRecordById(id);
    if (record) {
      activeRecords += 1;
    }
  }

  return activeRecords;
};

export const createStoredEnvelope = async (
  input: CreateStoredEnvelopeInput
): Promise<StoredEnvelopeRecord> => {
  if (REDIS_CLIENT) {
    const record: StoredEnvelopeRecord = {
      id: createId(),
      envelope: cloneEnvelope(input.envelope),
      createdAt: now().toISOString(),
      expiresAt: resolveExpiresAt(input.ttlSeconds),
      oneTime: input.oneTime ?? true,
      accessCount: 0,
    };

    await persistRedisRecord(record);
    return cloneRecord(record);
  }

  return withStore((records) => {
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
};

export const consumeEnvelopeById = async (
  id: string
): Promise<StoredEnvelopeRecord | null> => {
  if (REDIS_CLIENT) {
    const record = await loadRedisRecordById(id);
    if (!record) {
      return null;
    }

    const updatedRecord: StoredEnvelopeRecord = {
      ...record,
      accessCount: record.accessCount + 1,
    };

    if (updatedRecord.oneTime) {
      await deleteRedisRecordById(id);
    } else {
      await persistRedisRecord(updatedRecord);
    }

    return cloneRecord(updatedRecord);
  }

  return withStore((records) => {
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
};

export const deleteEnvelopeById = async (id: string): Promise<boolean> => {
  if (REDIS_CLIENT) {
    const deletedCount = await REDIS_CLIENT.del(redisEnvelopeKey(id));
    await REDIS_CLIENT.zrem(REDIS_INDEX_KEY, id);
    return deletedCount > 0;
  }

  return withStore((records) => records.delete(id));
};

export const getStoreStats = async (): Promise<{ activeRecords: number }> => {
  if (REDIS_CLIENT) {
    const activeRecords = await countRedisRecords();
    return { activeRecords };
  }

  return withStore((records) => ({ activeRecords: records.size }));
};

export const listEnvelopeSummaries = async (options?: {
  limit?: number;
}): Promise<StoredEnvelopeSummary[]> => {
  const limit = options?.limit ?? 20;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Summary limit must be a positive integer.");
  }

  if (REDIS_CLIENT) {
    const records = await listRedisRecords(limit);
    return records.map(toSummary);
  }

  return withStore((records) =>
    Array.from(records.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map(toSummary)
  );
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
