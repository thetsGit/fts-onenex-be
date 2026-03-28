import { type RouteHandler } from "@/types/http";

export async function fallbackJson() {
  return Response.json({ message: "Not found" }, { status: 404 });
}

export async function fallback() {
  return new Response("Not Found", { status: 404 });
}

const TELEMETRY_ROUTE = "/telemetry";
export const upgradeToWSOrFallback: RouteHandler<Response | undefined> = async (
  req,
  server,
) => {
  const url = new URL(req.url);
  if (url.pathname === TELEMETRY_ROUTE) {
    // upgrade the request to a WebSocket
    if (server.upgrade(req, { data: null })) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed", { status: 500 });
  }

  return fallback();
};
