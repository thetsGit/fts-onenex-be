/// <reference types="bun-types/overrides.d.ts" />
declare module "bun" {
  interface Env {
    readonly FTS_API_URL: string;
  }
}
