export const getSubtleCrypto = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SubtleCrypto is unavailable in this runtime.");
  }
  return subtle;
};

export const getRandomBytes = (length: number): Uint8Array => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("Random byte length must be a positive integer.");
  }

  const runtimeCrypto = globalThis.crypto;
  if (!runtimeCrypto?.getRandomValues) {
    throw new Error("Secure random generator is unavailable in this runtime.");
  }

  const bytes = new Uint8Array(length);
  runtimeCrypto.getRandomValues(bytes);
  return bytes;
};
