import { describe, expect, test } from "bun:test";

import { crc16 } from "@/core/crc";

import type { TelemetryData } from "@/types/entities";

import { parsePacket } from "@/telemetry/parser";

function buildPacket(
  overrides?: {
    startByte?: number;
    endByte?: number;
    skipCrc?: boolean;
    crcOverride?: number;
  } & Partial<TelemetryData>,
) {
  const buf = Buffer.alloc(36);
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

describe("parsePacket", () => {
  // Valid packet returns VALID with correct data
  test("valid packet returns VALID with correct data", () => {
    const packet = buildPacket();
    const result = parsePacket(packet);

    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      const {
        flightNumber,
        packetNumber,
        packetSize,
        altitude,
        speed,
        acceleration,
        thrust,
        temperature,
      } = result.data;
      expect(flightNumber).toBe("ONX101");
      expect(packetNumber).toBe(1);
      expect(packetSize).toBe(36);
      expect(altitude).toBe(10500.57);
      expect(speed).toBe(240.79);
      expect(acceleration).toBe(0.56);
      expect(thrust).toBe(100000.45);
      expect(temperature).toBe(20.39);
    }
  });

  // Wrong length
  test("short buffer returns CORRUPTED", () => {
    const packet = Buffer.alloc(20);
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  // Wrong start byte
  test("wrong start byte returns CORRUPTED", () => {
    const packet = buildPacket({ startByte: 0xff });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  // Wrong end byte
  test("wrong end byte returns CORRUPTED", () => {
    const packet = buildPacket({ endByte: 0xff });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  // Bad CRC
  test("corrupted CRC returns CORRUPTED", () => {
    const packet = buildPacket({ crcOverride: 0x0000 });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  // CRC valid but data corrupted (tampered altitude after CRC was calculated)
  test("tampered data with original CRC returns CORRUPTED", () => {
    const packet = buildPacket();
    // Overwrite altitude bytes after CRC is already set
    packet.writeFloatBE(99999.0, 13);
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  /**
   * Range validation tests
   */

  test("altitude too low returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ altitude: 8000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("altitude too high returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ altitude: 13000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("speed too low returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ speed: 200 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("speed too high returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ speed: 300 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("acceleration too low returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ acceleration: -5 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("acceleration too high returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ acceleration: 5 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("thrust too low returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ thrust: -1 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("thrust too high returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ thrust: 300000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("temperature too low returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ temperature: -60 }));
    expect(result.status).toBe("CORRUPTED");
  });

  test("temperature too high returns CORRUPTED", () => {
    const result = parsePacket(buildPacket({ temperature: 60 }));
    expect(result.status).toBe("CORRUPTED");
  });
});
