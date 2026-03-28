import { type TelemetryData } from "@/types/entities";

import type { TelemetryStatus } from "./constants";

export type TelemetryTcpSubscriptionPayload = {
  type: "subscribe";
  flightId: string;
  intervalMs: number;
};

export type TelemetryResult = {
  status: TelemetryStatus;
  data?: TelemetryData;
  message?: string;
};
