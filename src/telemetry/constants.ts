export const TELEMETRY_PACKET_SIZE = 36;
export const TELEMETRY_START_BYTE = 0x82;
export const TELEMETRY_END_BYTE = 0x80;

export const STATUSES = ["VALID", "CORRUPTED", "ERROR", "CLOSED"] as const;
export type TelemetryStatus = (typeof STATUSES)[number];

export const TCP_SUBSCRIPTION_INTERVAL_MS = 3000; // Min: 100ms, Max: 10000ms (tcp server's rule)
export const TCP_RECONNECT_DELAY = 3000;
