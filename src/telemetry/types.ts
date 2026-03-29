import { type TelemetryDetails } from "@/types/entities";

import type { TelemetryStatus } from "./constants";

export type TelemetryTcpSubscriptionPayload = {
  type: "subscribe";
  flightId: string;
  intervalMs: number;
};

export type TelemetryResult = {
  status: TelemetryStatus;
  data?: TelemetryDetails;
  message?: string;
};
