import { type Flight } from "@/types/entities";

/**
 * Http server
 */
export const FTS_BASE_API_URL = Bun.env.FTS_API_BASE_URL;
export const FTS_API_PORT = Bun.env.FTS_API_PORT;
export const FTS_API_URL = `${FTS_BASE_API_URL}:${FTS_API_PORT}`;
export const FLIGHTS_ENDPOINT = `${FTS_API_URL}/flights`;

export const ALLOWED_ORIGINS = (Bun.env.ALLOWED_ORIGINS || "")
  .split(",")
  .filter(Boolean);

export const getCorsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400", // Cache preflight response for 24 hours
});

/**
 * Tcp server
 */
export const FTS_TCP_HOSTNAME = Bun.env.FTS_TCP_HOSTNAME;

/**
 * WS server
 */
export const getWsTelemetryTopic = (flightId: Flight["id"]) =>
  `flight-id-${flightId}`;

export * from "./validateEnv";
