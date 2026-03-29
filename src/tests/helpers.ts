import { type TelemetryDetails } from "@/types/entities";

import { crc16 } from "@/core/crc";

import { TELEMETRY_PACKET_SIZE } from "@/telemetry/constants";

export function buildPacket(
  overrides?: {
    startByte?: number;
    endByte?: number;
    skipCrc?: boolean;
    crcOverride?: number;
  } & Partial<TelemetryDetails>,
) {
  const buf = Buffer.alloc(TELEMETRY_PACKET_SIZE);
  const o = overrides ?? {};

  buf.writeUInt8(o.startByte ?? 0x82, 0);

  // Flight number — 10 bytes, zero-padded ASCII
  const fn = o.flightNumber ?? " ONX101";
  for (let i = 0; i < 10; i++) {
    buf.writeUInt8(i < fn.length ? fn.charCodeAt(i) : 0, 1 + i);
  }

  buf.writeUInt8(o.packetNumber ?? 1, 11);
  buf.writeUInt8(o.packetSize ?? 0x24, 12);
  buf.writeFloatBE(o.altitude ?? 10500.5678, 13);
  buf.writeFloatBE(o.speed ?? 240.789, 17);
  buf.writeFloatBE(o.acceleration ?? 0.5566, 21);
  buf.writeFloatBE(o.thrust ?? 100000.456, 25);
  buf.writeFloatBE(o.temperature ?? 20.39, 29);

  // CRC over bytes 0-30
  if (!o.skipCrc) {
    const crc = o.crcOverride ?? crc16(buf, 0, 31);
    buf.writeUInt16BE(crc, 33);
  }

  buf.writeUInt8(o.endByte ?? 0x80, 35);
  return buf;
}
