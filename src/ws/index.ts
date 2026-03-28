import { type ServerWebSocket } from "bun";

import { isWSSubscribePayload } from "@/types/ws";

import { getWsTelemetryTopic } from "@/config";

export const onWSMessage = (
  ws: ServerWebSocket<unknown>,
  message: string | Buffer<ArrayBuffer>,
) => {
  if (typeof message === "string") {
    /**
     * Let clients subscribe telemetry data by flightId
     */
    const payload = JSON.parse(message);
    if (isWSSubscribePayload(payload)) {
      ws.subscribe(getWsTelemetryTopic(payload.flightId));
    }
  }
};
