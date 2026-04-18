"use server";

import type { SecretEnvelope } from "@/lib/crypto/types";
import { isSecretEnvelope } from "@/lib/crypto/validators";
import { consumeEnvelopeById } from "@/lib/server/zk-store";

interface RetrieveResult {
  envelope: SecretEnvelope | null;
  error: string | null;
  oneTime: boolean | null;
  success: boolean;
}

export async function retrieveEnvelopeAction(
  id: string
): Promise<RetrieveResult> {
  if (typeof id !== "string" || id.trim().length === 0) {
    return {
      success: false,
      error: "Envelope ID is required.",
      envelope: null,
      oneTime: null,
    };
  }

  const sanitizedId = id.trim();
  const record = await consumeEnvelopeById(sanitizedId);

  if (!record) {
    return {
      success: false,
      error: "Envelope not found or has expired.",
      envelope: null,
      oneTime: null,
    };
  }

  if (!isSecretEnvelope(record.envelope)) {
    return {
      success: false,
      error: "Stored envelope has an invalid format.",
      envelope: null,
      oneTime: null,
    };
  }

  return {
    success: true,
    error: null,
    envelope: record.envelope,
    oneTime: record.oneTime,
  };
}
