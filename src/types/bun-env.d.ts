/// <reference types="bun-types/overrides.d.ts" />
declare module "bun" {
  interface Env {
    readonly FTS_API_BASE_URL: string;
    readonly FTS_API_PORT: string;
    readonly FTS_TCP_HOSTNAME: string;
  }
}
