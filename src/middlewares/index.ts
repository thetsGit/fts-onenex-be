import { getCorsHeaders } from "@/config";

import { type RouteHandler } from "@/types/http";

export function withCors(handler: RouteHandler) {
  return (async (req, server) => {
    const response = await handler(req, server);

    const origin = req.headers.get("origin") || "";

    // Append default CORS headers to the original headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...response.headers,
        ...getCorsHeaders(origin),
      },
    });
  }) satisfies RouteHandler;
}
