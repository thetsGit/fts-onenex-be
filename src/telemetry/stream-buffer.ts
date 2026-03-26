export class StreamBuffer {
  private buffer = Buffer.alloc(0);

  public append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  public extract(): Buffer[] {
    if (this.buffer.length < 36) return [];

    const packets: Buffer[] = [];

    while (this.buffer.length >= 36) {
      const startIdx = this.buffer.indexOf(0x82);

      // If 'start byte' not found, reset the whole buffer, stop the finding
      if (startIdx === -1) {
        this.buffer = Buffer.alloc(0);
        break;
      }

      const endIdx = startIdx + 35;

      // If endIdx exceeds buffer length, stop the finding and wait for more buffers appended
      if (endIdx + 1 > this.buffer.length) {
        this.buffer = this.buffer.subarray(startIdx);
        break;
      }

      // If 'end byte' is invalid, strip all the bytes including 'start byte'
      const end = this.buffer[endIdx];
      if (end !== 0x80) {
        this.buffer = this.buffer.subarray(startIdx + 1);

        // If the left buffer length after stripping is less than 36, stop finding and wait for more buffers appended
        if (this.buffer.length < 36) {
          break;
        }

        continue;
      }

      // If a valid packet is found, extract it and strip it out of the global buffer

      const packet = this.buffer.subarray(startIdx, endIdx + 1);
      this.buffer = this.buffer.subarray(endIdx + 1);

      packets.push(packet);
    }

    return packets;
  }
}
