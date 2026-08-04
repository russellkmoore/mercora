/**
 * Storage extension keyed only by the upload route's accepted MIME types.
 * Never derive an object extension from the client-controlled File.name.
 */
export const EXT_BY_MIME: Partial<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function matchesAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Verify that actual leading bytes match the declared image MIME type. */
export function matchesImageSignature(bytes: Uint8Array, declaredType: string): boolean {
  const normalizedType = declaredType === 'image/jpg' ? 'image/jpeg' : declaredType;

  switch (normalizedType) {
    case 'image/png':
      return matchesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return matchesAt(bytes, 0, [0xff, 0xd8, 0xff]);
    case 'image/gif':
      return matchesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        matchesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    case 'image/webp':
      return matchesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
        matchesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50]);
    default:
      return false;
  }
}
