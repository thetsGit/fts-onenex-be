import { crc16 } from "@/core/crc";

import type { TelemetryData } from "@/types/entities";

import {
  TELEMETRY_END_BYTE,
  TELEMETRY_PACKET_SIZE,
  TELEMETRY_START_BYTE,
  type TelemetryStatus,
} from "./constants";

export type ParsePacketReturn =
  | {
      status: Extract<TelemetryStatus, "CORRUPTED">;
      message: string;
    }
  | {
      status: Extract<TelemetryStatus, "VALID">;
      data: TelemetryData;
    };

export function parsePacket(buffer: Uint8Array): ParsePacketReturn {
  const bufferDataView = new DataView(buffer.buffer);

  /**
   * Check length
   */
  if (bufferDataView.byteLength !== TELEMETRY_PACKET_SIZE) {
    return { status: "CORRUPTED", message: "Invalid packet length" };
  }

  /**
   * Check 'start byte' and 'end byte'
   */
  if (buffer[0] !== TELEMETRY_START_BYTE || buffer[35] !== TELEMETRY_END_BYTE) {
    return { status: "CORRUPTED", message: "Invalid start or end byte" };
  }

  /**
   * CRC check
   */
  const originalCRC = bufferDataView.getUint16(33, false);
  const calculatedCRC = crc16(buffer, 0, 31);
  if (calculatedCRC !== originalCRC) {
    return { status: "CORRUPTED", message: "Invalid CRC" };
  }

  /**
   * Parse data from bytes
   */

  // Parse 'flight number' — strip extra null bytes (10 bytes - zero padded) and strip trailing whitespace
  const flightNumber = new TextDecoder()
    .decode(buffer.slice(1, 11))
    .replace(/\0/g, "")
    .trim();

  const packetNumber = bufferDataView.getUint8(11);
  const packetSize = bufferDataView.getUint8(12);
  const altitude = bufferDataView.getFloat32(13, false);
  const speed = bufferDataView.getFloat32(17, false);
  const acceleration = bufferDataView.getFloat32(21, false);
  const thrust = bufferDataView.getFloat32(25, false);
  const temperature = bufferDataView.getFloat32(29, false);

  /**
   * Validate if values are in ranges
   */
  if (altitude < 9000 || altitude > 12000) {
    return { status: "CORRUPTED", message: "Invalid altitude" };
  }
  if (speed < 220 || speed > 260) {
    return { status: "CORRUPTED", message: "Invalid speed" };
  }
  if (acceleration < -2 || acceleration > 2) {
    return { status: "CORRUPTED", message: "Invalid acceleration" };
  }
  if (thrust < 0 || thrust > 200000) {
    return { status: "CORRUPTED", message: "Invalid thrust" };
  }
  if (temperature < -50 || temperature > 50) {
    return { status: "CORRUPTED", message: "Invalid temperature" };
  }

  /**
   * Round the floating point values to 2 decimal places
   */
  const altitudeRounded = parseFloat(altitude.toFixed(2));
  const speedRounded = parseFloat(speed.toFixed(2));
  const accelerationRounded = parseFloat(acceleration.toFixed(2));
  const thrustRounded = parseFloat(thrust.toFixed(2));
  const temperatureRounded = parseFloat(temperature.toFixed(2));

  /**
   * Return the parsed result
   */
  return {
    status: "VALID",
    data: {
      flightNumber,
      packetNumber,
      packetSize,
      altitude: altitudeRounded,
      speed: speedRounded,
      acceleration: accelerationRounded,
      thrust: thrustRounded,
      temperature: temperatureRounded,
    },
  };
}
