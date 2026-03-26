import { describe, expect, it } from "bun:test";

import { parsePacket } from "@/telemetry/parser";

import { buildPacket } from "@/tests/helpers";

describe("parsePacket", () => {
  it("should parse valid packet correctly", () => {
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

  it("should return CORRUPTED in case of short buffer", () => {
    const packet = Buffer.alloc(20);
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED in case of wrong start", () => {
    const packet = buildPacket({ startByte: 0xff });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED in case of wrong end byte", () => {
    const packet = buildPacket({ endByte: 0xff });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED in case of corrupted CRC", () => {
    const packet = buildPacket({ crcOverride: 0x0000 });
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  // CRC valid but data corrupted (tampered altitude after CRC was calculated)
  it("should return CORRUPTED in case of tampered data with original CRC", () => {
    const packet = buildPacket();
    // Overwrite altitude bytes after CRC is already set
    packet.writeFloatBE(99999.0, 13);
    const result = parsePacket(packet);
    expect(result.status).toBe("CORRUPTED");
  });

  /**
   * Range validation tests
   */

  it("should return CORRUPTED when altitude is too low", () => {
    const result = parsePacket(buildPacket({ altitude: 8000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when altitude is too high", () => {
    const result = parsePacket(buildPacket({ altitude: 13000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when speed is too low", () => {
    const result = parsePacket(buildPacket({ speed: 200 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when speed is too high", () => {
    const result = parsePacket(buildPacket({ speed: 300 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when acceleration is too low", () => {
    const result = parsePacket(buildPacket({ acceleration: -5 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when acceleration too high", () => {
    const result = parsePacket(buildPacket({ acceleration: 5 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when thrust is too low", () => {
    const result = parsePacket(buildPacket({ thrust: -1 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when thrust is too high", () => {
    const result = parsePacket(buildPacket({ thrust: 300000 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when temperature is too low", () => {
    const result = parsePacket(buildPacket({ temperature: -60 }));
    expect(result.status).toBe("CORRUPTED");
  });

  it("should return CORRUPTED when temperature is too high", () => {
    const result = parsePacket(buildPacket({ temperature: 60 }));
    expect(result.status).toBe("CORRUPTED");
  });
});
