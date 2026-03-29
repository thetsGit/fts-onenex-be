export const mbToBytesRate = 1024 * 1024;

export const mbToBytes = (mb: number) => mb * mbToBytesRate;
export const bytesToMb = (bytes: number) => (bytes / mbToBytesRate).toFixed(1);
