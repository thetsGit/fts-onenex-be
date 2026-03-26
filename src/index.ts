import { fallbackJson, fallback } from "@/routes/general";
import { getFlights } from "@/routes/flights";

import { validateEnvironment } from "./validateEnv";

// Validate environment variables at startup
validateEnvironment();

const server = Bun.serve({
  // `routes` requires Bun v1.2.3+
  routes: {
    // Proxy 'flights' endpoint
    "/api/flights": getFlights,

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": fallbackJson,
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch: fallback,
});

console.log(`Server running at ${server.url}`);
