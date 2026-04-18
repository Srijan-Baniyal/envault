"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { assertSecretEnvelope } from "@/lib/crypto/validators";
import { ENVELOPE_STORE_CACHE_TAG } from "@/lib/server/envelope-service";
import {
  consumeEnvelopeById,
  createStoredEnvelope,
  deleteEnvelopeById,
} from "@/lib/server/zk-store";

const toStringValue = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value.trim() : "";

const toOptionalInteger = (value: string): number | undefined => {
  if (value.length === 0) {
    return;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("ttlSeconds must be an integer.");
  }

  return parsed;
};

const safeMessage = (value: string): string =>
  encodeURIComponent(value.slice(0, 120));

export const storeEnvelopeAction = (formData: FormData): void => {
  const envelopeRaw = toStringValue(formData.get("envelopeJson"));
  const ttlRaw = toStringValue(formData.get("ttlSeconds"));
  const oneTime = formData.get("oneTime") === "on";

  if (envelopeRaw.length === 0) {
    redirect(
      `/?status=error&message=${safeMessage("Envelope JSON is required.")}`
    );
  }

  try {
    const parsedEnvelope = JSON.parse(envelopeRaw) as unknown;
    assertSecretEnvelope(parsedEnvelope);

    const record = createStoredEnvelope({
      envelope: parsedEnvelope,
      oneTime,
      ttlSeconds: toOptionalInteger(ttlRaw),
    });

    updateTag(ENVELOPE_STORE_CACHE_TAG);
    redirect(
      `/?status=ok&message=${safeMessage(`Envelope ${record.id} stored.`)}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid envelope payload.";
    redirect(`/?status=error&message=${safeMessage(message)}`);
  }
};

export const deleteEnvelopeAction = (formData: FormData): void => {
  const id = toStringValue(formData.get("id"));

  if (id.length === 0) {
    redirect(
      `/?status=error&message=${safeMessage("Envelope id is required.")}`
    );
  }

  const deleted = deleteEnvelopeById(id);
  updateTag(ENVELOPE_STORE_CACHE_TAG);

  if (!deleted) {
    redirect(
      `/?status=error&message=${safeMessage(`Envelope ${id} not found.`)}`
    );
  }

  redirect(`/?status=ok&message=${safeMessage(`Envelope ${id} deleted.`)}`);
};

export const consumeEnvelopeAction = (formData: FormData): void => {
  const id = toStringValue(formData.get("id"));

  if (id.length === 0) {
    redirect(
      `/?status=error&message=${safeMessage("Envelope id is required.")}`
    );
  }

  const consumed = consumeEnvelopeById(id);
  updateTag(ENVELOPE_STORE_CACHE_TAG);

  if (!consumed) {
    redirect(
      `/?status=error&message=${safeMessage(`Envelope ${id} not found or expired.`)}`
    );
  }

  redirect(`/?status=ok&message=${safeMessage(`Envelope ${id} consumed.`)}`);
};
