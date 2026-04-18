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

export const getEnvelopeStoreOverview = (): EnvelopeStoreOverview => {
  "use cache";

  cacheTag(ENVELOPE_STORE_CACHE_TAG);
  cacheLife("minutes");

  return {
    generatedAt: new Date().toISOString(),
    limits: getStoreDefaults(),
    stats: getStoreStats(),
  };
};

export const listRecentEnvelopeSummaries = (
  limit = 20
): StoredEnvelopeSummary[] => {
  "use cache";

  cacheTag(ENVELOPE_STORE_CACHE_TAG);
  cacheLife("minutes");

  return listEnvelopeSummaries({ limit });
};
