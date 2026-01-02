// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Bitstream reader for H264 data, handling emulation prevention bytes and
 * decoding exponential Golomb format integers.
 */
export class Bitstream {
  #ptr: number = 0;
  #bytePtr: number = 0;
  #lastTwoBytes: number = 0;
  readonly #buffer: Uint8Array;
  readonly #max: number;

  /**
   * Construct a bitstream
   * @param stream Buffer containing the stream
   */
  public constructor(stream: Uint8Array) {
    this.#buffer = stream;
    this.#max = this.#buffer.byteLength << 3;
  }

  public reset(): void {
    this.#ptr = 0;
    this.#bytePtr = 0;
    this.#lastTwoBytes = 0;
  }

  /**
   * get one bit
   * @returns {number}
   */
  public u_1(): number {
    if (this.#ptr + 1 > this.#max) {
      throw new Error("Bitstream error: bitstream exhausted");
    }

    const byteOffset = this.#ptr >> 3;
    const bitOffset = 0x07 - (this.#ptr & 0x07);

    // Save the current buffer pointer
    const savedBytePtr = this.#bytePtr;

    // Set the buffer pointer to the start of the byte containing the bit we are interested in
    this.#bytePtr = byteOffset;

    // Read the byte (with possible deemulation)
    const byte = this.#readByte();

    // Restore the buffer pointer
    this.#bytePtr = savedBytePtr;

    const val = (byte >> bitOffset) & 0x01;
    this.#ptr++;
    return val;
  }

  /**
   * get two bits
   * @returns {number}
   */
  public u_2(): number {
    return (this.u_1() << 1) | this.u_1();
  }

  /**
   * get three bits
   * @returns {number}
   */
  public u_3(): number {
    return (this.u_1() << 2) | (this.u_1() << 1) | this.u_1();
  }

  /**
   * get one byte (as an unsigned number)
   * @returns {number}
   */
  public u_8(): number {
    if (this.#ptr + 8 > this.#max) {
      throw new Error("Bitstream error: bitstream exhausted");
    }
    const byteOffset = this.#ptr >> 3;
    const bitOffset = this.#ptr & 0x07;

    // Save the current buffer pointer
    const savedBytePtr = this.#bytePtr;

    // Set the buffer pointer to the start of the byte containing the first bit we are interested in
    this.#bytePtr = byteOffset;

    // If the current bit pointer is not aligned with a byte boundary
    if (bitOffset !== 0) {
      // Read the two bytes straddling the bit boundary (with possible deemulation)
      const byte1 = this.#readByte();
      const byte2 = this.#readByte();

      // Extract the 8 bits we are interested in
      const val =
        ((byte1 & ((1 << (8 - bitOffset)) - 1)) << bitOffset) | (byte2 >> (8 - bitOffset));

      // Restore the buffer pointer
      this.#bytePtr = savedBytePtr;

      this.#ptr += 8;
      return val;
    } else {
      // Read the byte (with possible deemulation)
      const val = this.#readByte();

      // Restore the buffer pointer
      this.#bytePtr = savedBytePtr;

      this.#ptr += 8;
      return val;
    }
  }

  /**
   * get an unsigned H.264-style variable-bit number
   * in exponential Golomb format
   * @returns {number}
   */
  public ue_v(): number {
    let zeros = 0;
    while (this.u_1() === 0) {
      zeros++;
    }
    let val = 1 << zeros;
    for (let i = zeros - 1; i >= 0; i--) {
      val |= this.u_1() << i;
    }
    return val - 1;
  }

  /**
   * get a signed h.264-style variable bit number
   * in exponential Golomb format
   * @returns {number} (without negative zeros)
   */
  public se_v(): number {
    const codeword = this.ue_v();
    const result = (codeword & 1) === 1 ? 1 + (codeword >> 1) : -(codeword >> 1);
    return result === 0 ? 0 : result;
  }

  /**
   * get n bits
   * @param n
   * @returns {number}
   */
  public u(n: number): number {
    if (n === 8) {
      return this.u_8();
    }
    if (this.#ptr + n >= this.#max) {
      throw new Error("NALUStream error: bitstream exhausted");
    }
    let val = 0;
    for (let i = 0; i < n; i++) {
      val = (val << 1) | this.u_1();
    }
    return val;
  }

  #readByte(): number {
    if (this.#bytePtr >= this.#buffer.length) {
      throw new Error("Attempted to read past end of buffer");
    }

    // If the current byte is 0x03 and the last two bytes were zeros, skip over it
    if (this.#buffer[this.#bytePtr] === 0x03 && this.#lastTwoBytes === 0) {
      this.#bytePtr++;
      this.#ptr += 8; // Skip 8 bits in the bitstream
      this.#lastTwoBytes = (this.#lastTwoBytes << 8) & 0xffff; // Shift in a zero to the last two bytes
    }

    // Update the last two bytes and return the current byte
    this.#lastTwoBytes = ((this.#lastTwoBytes << 8) | this.#buffer[this.#bytePtr]!) & 0xffff;
    return this.#buffer[this.#bytePtr++]!;
  }
}
