import { describe, expect, it } from "bun:test";

import { StreamBuffer } from "@/telemetry/stream-buffer";

import { buildPacket } from "@/tests/helpers";

describe("StreamBuffer", () => {
  it("should extract single complete packet correctly", () => {
    const sb = new StreamBuffer();
    const packet = buildPacket();

    sb.append(packet);
    const result = sb.extract();

    expect(result.length).toBe(1);
    expect(result[0].length).toBe(36);
    expect(result[0][0]).toBe(0x82);
    expect(result[0][35]).toBe(0x80);
  });

  it("should extract two concatenated packets correctly", () => {
    const sb = new StreamBuffer();
    const packet1 = buildPacket({ flightNumber: "ONX101" });
    const packet2 = buildPacket({ flightNumber: "ONX102" });

    sb.append(Buffer.concat([packet1, packet2]));
    const result = sb.extract();

    expect(result.length).toBe(2);
  });

  it("should extract partial packets across two appends correctly", () => {
    const sb = new StreamBuffer();
    const packet = buildPacket();
    const firstHalf = packet.subarray(0, 20);
    const secondHalf = packet.subarray(20);

    sb.append(Buffer.from(firstHalf));
    expect(sb.extract().length).toBe(0);

    sb.append(Buffer.from(secondHalf));
    const result = sb.extract();
    expect(result.length).toBe(1);
    expect(result[0][0]).toBe(0x82);
    expect(result[0][35]).toBe(0x80);
  });

  it("should skip any prefix garbage bytes before valid packet", () => {
    const sb = new StreamBuffer();
    const garbage = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37]);
    const packet = buildPacket();

    sb.append(Buffer.concat([garbage, packet]));
    const result = sb.extract();

    expect(result.length).toBe(1);
    expect(result[0][0]).toBe(0x82);
  });

  it("should skip false start where 0x82 appears but 0x80 not at offset +35", () => {
    const sb = new StreamBuffer();
    const falseStart = Buffer.alloc(10);
    falseStart[0] = 0x82;
    const realPacket = buildPacket();

    sb.append(Buffer.concat([falseStart, realPacket]));
    const result = sb.extract();

    expect(result.length).toBe(1);
    expect(result[0][0]).toBe(0x82);
    expect(result[0][35]).toBe(0x80);
  });

  it("should return empty array when buffer is empty", () => {
    const sb = new StreamBuffer();
    expect(sb.extract().length).toBe(0);
  });

  it("should return empty array when buffer has less than 36 bytes", () => {
    const sb = new StreamBuffer();

    sb.append(Buffer.alloc(20));
    const result = sb.extract();

    expect(result.length).toBe(0);
  });

  it("should extract packet while ignoring another incomplete yet packet following it", () => {
    const sb = new StreamBuffer();
    const completePacket = buildPacket();
    const incompletePacket = buildPacket().subarray(0, 20);

    sb.append(Buffer.concat([completePacket, incompletePacket]));
    const result = sb.extract();

    expect(result.length).toBe(1);
  });

  it("should extract packet correctly when valid packet is between two chunks of garbage", () => {
    const sb = new StreamBuffer();
    const prefixGarbage = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37]);
    const postfixGarbage = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37]);
    const packet = buildPacket();
    const packetFirstHalf = packet.subarray(0, 20);
    const packetSecondHalf = packet.subarray(20);

    sb.append(Buffer.concat([prefixGarbage, packetFirstHalf]));
    const midResult = sb.extract();
    expect(midResult.length).toBe(0);

    sb.append(Buffer.concat([packetSecondHalf, postfixGarbage]));
    const finalResult = sb.extract();
    expect(finalResult.length).toBe(1);
    expect(finalResult[0][0]).toBe(0x82);
  });

  it("should handle multiple appends building up to multiple packets correctly", () => {
    const sb = new StreamBuffer();
    const packet1 = buildPacket();
    const packet2 = buildPacket();
    const packet3 = buildPacket();
    const packet4 = buildPacket();
    const packet5 = buildPacket();

    sb.append(packet1);
    sb.append(packet2);
    sb.append(packet3);
    sb.append(packet4);
    sb.append(packet5);
    const result = sb.extract();

    expect(result.length).toBe(5);
  });
});
