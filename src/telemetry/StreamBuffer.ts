import {
  TELEMETRY_END_BYTE,
  TELEMETRY_PACKET_SIZE,
  TELEMETRY_START_BYTE,
} from "./constants";

export class StreamBuffer {
  private _buffer = Buffer.alloc(0);

  constructor(
    private _packetSize = TELEMETRY_PACKET_SIZE,
    private _startByte = TELEMETRY_START_BYTE,
    private _endByte = TELEMETRY_END_BYTE,
  ) {}

  public append(data: Buffer): void {
    this._buffer = Buffer.concat([this._buffer, data]);
  }

  public extract(): Buffer[] {
    if (this._buffer.length < this._packetSize) return [];

    const packets: Buffer[] = [];

    while (this._buffer.length >= this._packetSize) {
      const startIdx = this._buffer.indexOf(this._startByte);

      /**
       * If 'start byte' not found, reset the whole buffer, stop the finding
       */
      if (startIdx === -1) {
        this._buffer = Buffer.alloc(0);
        break;
      }

      const endIdx = startIdx + (this._packetSize - 1);

      /**
       * If endIdx exceeds buffer length, stop the finding and wait for more buffers appended
       */
      if (endIdx + 1 > this._buffer.length) {
        this._buffer = this._buffer.subarray(startIdx);
        break;
      }

      /**
       * If 'end byte' is invalid, strip all the bytes including 'start byte'
       */
      const end = this._buffer[endIdx];
      if (end !== this._endByte) {
        this._buffer = this._buffer.subarray(startIdx + 1);

        /**
         * If the left buffer length after stripping is less than 36, stop finding and wait for more buffers appended
         */
        if (this._buffer.length < this._packetSize) {
          break;
        }

        continue;
      }

      /**
       * If a valid packet is found, extract it and also strip it out of the global buffer
       */

      const packet = this._buffer.subarray(startIdx, endIdx + 1);
      this._buffer = this._buffer.subarray(endIdx + 1);

      packets.push(packet);
    }

    return packets;
  }
}
