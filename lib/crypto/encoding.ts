const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

const hasBuffer = (): boolean => typeof Buffer !== "undefined";

const toBase64 = (bytes: Uint8Array): string => {
  if (hasBuffer()) {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  if (hasBuffer()) {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const utf8ToBytes = (value: string): Uint8Array =>
  textEncoder.encode(value);

export const bytesToUtf8 = (value: Uint8Array): string =>
  textDecoder.decode(value);

export const bytesToBase64Url = (value: Uint8Array): string =>
  toBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

export const base64UrlToBytes = (value: string): Uint8Array => {
  if (!BASE64URL_PATTERN.test(value)) {
    throw new Error("Invalid base64url input.");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized.padEnd(normalized.length + paddingLength, "=");
  return fromBase64(padded);
};

export const joinBytes = (...segments: Uint8Array[]): Uint8Array => {
  let totalLength = 0;
  for (const segment of segments) {
    totalLength += segment.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const segment of segments) {
    result.set(segment, offset);
    offset += segment.length;
  }

  return result;
};
