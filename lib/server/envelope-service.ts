import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import {
  getStoreDefaults,
  getStoreStats,
  listEnvelopeSummaries,
  type StoredEnvelopeSummary,
} from "@/lib/server/zk-store";

export const ENVELOPE_STORE_CACHE_TAG = "shareenv:envelopes" as const;

export interface EnvelopeStoreOverview {
  generatedAt: string;
  limits: {
    defaultTtlSeconds: number;
    maxTtlSeconds: number;
    oneTimeByDefault: boolean;
  };
  stats: {
    activeRecords: number;
  };
}

export async function getEnvelopeStoreOverview(): Promise<EnvelopeStoreOverview> {
  "use cache";

  cacheTag(ENVELOPE_STORE_CACHE_TAG);
  cacheLife("minutes");

  return {
    generatedAt: new Date().toISOString(),
    limits: await getStoreDefaults(),
    stats: await getStoreStats(),
  };
}

export async function listRecentEnvelopeSummaries(
  limit = 20
): Promise<StoredEnvelopeSummary[]> {
  "use cache";

  cacheTag(ENVELOPE_STORE_CACHE_TAG);
  cacheLife("minutes");

  return await listEnvelopeSummaries({ limit });
}
