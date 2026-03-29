export type Flight = {
  id: string;
  model: string;
  flightNumber: string;
  origin: string;
  destination: string;
  telemetryPort: number;
};

export type TelemetryDetails = {
  flightNumber: string;
  packetNumber: number;
  packetSize: number;
  altitude: number;
  speed: number;
  acceleration: number;
  thrust: number;
  temperature: number;
};
