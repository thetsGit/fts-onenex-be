import {
  TELEMETRY_END_BYTE,
  TELEMETRY_PACKET_SIZE,
  TELEMETRY_START_BYTE,
} from "./constants";

export class StreamBuffer {
  private buffer = Buffer.alloc(0);

  constructor(
    private packetSize = TELEMETRY_PACKET_SIZE,
    private startByte = TELEMETRY_START_BYTE,
    private endByte = TELEMETRY_END_BYTE,
  ) {}

  public append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  public extract(): Buffer[] {
    if (this.buffer.length < this.packetSize) return [];

    const packets: Buffer[] = [];

    while (this.buffer.length >= this.packetSize) {
      const startIdx = this.buffer.indexOf(this.startByte);

      /**
       * If 'start byte' not found, reset the whole buffer, stop the finding
       */
      if (startIdx === -1) {
        this.buffer = Buffer.alloc(0);
        break;
      }

      const endIdx = startIdx + (this.packetSize - 1);

      /**
       * If endIdx exceeds buffer length, stop the finding and wait for more buffers appended
       */
      if (endIdx + 1 > this.buffer.length) {
        this.buffer = this.buffer.subarray(startIdx);
        break;
      }

      /**
       * If 'end byte' is invalid, strip all the bytes including 'start byte'
       */
      const end = this.buffer[endIdx];
      if (end !== this.endByte) {
        this.buffer = this.buffer.subarray(startIdx + 1);

        /**
         * If the left buffer length after stripping is less than 36, stop finding and wait for more buffers appended
         */
        if (this.buffer.length < this.packetSize) {
          break;
        }

        continue;
      }

      /**
       * If a valid packet is found, extract it and also strip it out of the global buffer
       */

      const packet = this.buffer.subarray(startIdx, endIdx + 1);
      this.buffer = this.buffer.subarray(endIdx + 1);

      packets.push(packet);
    }

    return packets;
  }
}
