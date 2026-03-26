export function crc16(data: Uint8Array, offset: number, length: number) {
  // Validate input
  if (
    data == null ||
    offset < 0 ||
    offset > data.length - 1 ||
    offset + length > data.length
  ) {
    return 0;
  }

  // Initialize CRC value
  let crc = 0xffff;

  // Iterate over each byte in the data
  for (let i = 0; i < length; ++i) {
    // Shift the CRC value left by 8 bits and XOR with the current byte
    crc ^= data[offset + i] << 8;

    // Perform 8 iterations of CRC calculation (polynomial 0x1021)
    for (let j = 0; j < 8; ++j) {
      crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }

  // Return the CRC value with the high byte masked off
  return crc & 0xffff;
}
