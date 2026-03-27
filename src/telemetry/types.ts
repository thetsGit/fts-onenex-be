import { type TelemetryData } from "@/types/entities";

import type { TelemetryStatus } from "./constants";

export type TelemetryTcpResult =
  | {
      status: Extract<TelemetryStatus, "CORRUPTED">;
      message: string;
    }
  | {
      status: Extract<TelemetryStatus, "ERROR">;
      message: string;
    }
  | {
      status: Extract<TelemetryStatus, "CLOSED">;
      message: string;
    }
  | {
      status: Extract<TelemetryStatus, "VALID">;
      data: TelemetryData;
    };

export type TelemetryTcpSubscriptionPayload = {
  type: "subscribe";
  flightId: string;
  intervalMs: number;
};
