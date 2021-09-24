// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import StreamBuffer from "./StreamBuffer";

function toArray(view: DataView) {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

describe("ByteStorage", () => {
  it("handles basic append and consume", () => {
    const buffer = new StreamBuffer();
    expect(buffer.bytesRemaining()).toBe(0);

    buffer.append(new Uint8Array([1, 2, 3]));
    expect(buffer.bytesRemaining()).toBe(3);
    expect(() => buffer.consume(4)).toThrow();

    expect(toArray(buffer.view)).toEqual(new Uint8Array([1, 2, 3]));
    buffer.consume(3);
    expect(buffer.bytesRemaining()).toBe(0);
  });

  it("handles partial consume", () => {
    const buffer = new StreamBuffer();

    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    expect(buffer.bytesRemaining()).toBe(5);
    buffer.consume(2);
    expect(buffer.bytesRemaining()).toBe(3);

    expect(toArray(buffer.view)).toEqual(new Uint8Array([3, 4, 5]));
    buffer.consume(3);
    expect(buffer.bytesRemaining()).toBe(0);
  });

  it("reuses buffer within allocated capacity", () => {
    const buffer = new StreamBuffer(5);
    const rawBuffer = buffer.view.buffer;
    buffer.append(new Uint8Array([1, 2]));
    expect(buffer.view.buffer).toBe(rawBuffer);
    buffer.append(new Uint8Array([3, 4, 5]));
    expect(buffer.view.buffer).toBe(rawBuffer);
    buffer.append(new Uint8Array([6, 7]));
    expect(buffer.view.buffer).not.toBe(rawBuffer);
    expect(toArray(buffer.view)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
  });
});
