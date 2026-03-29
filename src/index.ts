import { MEMORY_CHECK_INTERVAL_MS, validateEnvironment } from "@/config";

import type { MemoryUsageSignal } from "@/types/supervisor";

import { withCors } from "@/middlewares";

import { fallbackJson, upgradeToWSOrFallback } from "@/routes/general";
import { getFlights } from "@/routes/flights";

import { onWSMessage } from "@/ws";

import { FlightManager, startTelemetryService } from "@/telemetry";

// Validate environment variables at startup
validateEnvironment();

const server = Bun.serve({
  // `routes` requires Bun v1.2.3+
  routes: {
    // Proxy 'flights' endpoint
    "/api/flights": {
      OPTIONS: withCors(() => new Response(null, { status: 204 })),
      GET: withCors(getFlights),
    },

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": fallbackJson,
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch: upgradeToWSOrFallback,

  websocket: {
    message: onWSMessage,
  },
});

/**
 * Launch the telemetry service at start up
 */

const flightManager = new FlightManager({ server });

startTelemetryService(flightManager);

/**
 * Periodic memory usage report to supervisor for auto restart on memory limit hit
 */
setInterval(() => {
  try {
    process?.send?.({
      type: "memory",
      rss: process.memoryUsage().rss,
    } satisfies MemoryUsageSignal);
  } catch {
    // Ignore, i.e, not running under supervisor
  }
}, MEMORY_CHECK_INTERVAL_MS);
