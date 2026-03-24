import { type Flight } from "./types/entities";

import { FLIGHTS_ENDPOINT } from "./config";

import { validateEnvironment } from "./validateEnv";

// Validate environment variables at startup
validateEnvironment();

const server = Bun.serve({
  // `routes` requires Bun v1.2.3+
  routes: {
    // Proxy 'flights' endpoint
    "/api/flights": {
      GET: async () => {
        try {
          const response = await fetch(FLIGHTS_ENDPOINT);
          const data = (await response.json()) as Flight[];
          return Response.json(data, { status: response.status });
        } catch (error) {
          return Response.json(
            { message: "Failed to fetch flights" },
            { status: 502 },
          );
        }
      },
    },

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
