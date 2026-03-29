import type { Flight } from "./entities";

export type WSSubscribePayload = {
  action: "subscribe";
  flightId: Flight["id"];
};

export function isWSSubscribePayload(
  message: unknown,
): message is WSSubscribePayload {
  return (
    (message as WSSubscribePayload)?.action === "subscribe" &&
    (message as WSSubscribePayload)?.flightId !== undefined
  );
}
