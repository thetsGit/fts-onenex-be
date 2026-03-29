import type { BunRequest, Server, MaybePromise } from "bun";

// TODO: should replace with bun's built-in RouteHandler
export type RouteHandler<Res = Response> = (
  req: BunRequest,
  server: Server<unknown>,
) => MaybePromise<Res>;
