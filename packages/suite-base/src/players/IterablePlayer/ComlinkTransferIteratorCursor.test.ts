// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as Comlink from "@lichtblick/comlink";
import { MessageEvent } from "@lichtblick/suite";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import { ComlinkTransferIteratorCursor } from "./ComlinkTransferIteratorCursor";
import type { IMessageCursor, IteratorResult } from "./IIterableSource";

jest.mock("@lichtblick/comlink", () => ({
  transfer: jest.fn((value, transferables) => ({ value, transferables })),
}));

describe("ComlinkTransferIteratorCursor", () => {
  let mockCursor: jest.Mocked<IMessageCursor<Uint8Array>>;

  beforeEach(() => {
    mockCursor = {
      next: jest.fn(),
      nextBatch: jest.fn(),
      readUntil: jest.fn(),
      end: jest.fn(),
    };
    (Comlink.transfer as jest.Mock).mockClear();
  });

  it("transfers buffer in next() if type is 'message-event' and message is Uint8Array", async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const input: IteratorResult<Uint8Array> = {
      type: "message-event",
      msgEvent: { message: new Uint8Array(buffer) } as MessageEvent<Uint8Array>,
    };

    mockCursor.next.mockResolvedValueOnce(input);

    const cursor = new ComlinkTransferIteratorCursor(mockCursor);
    const result = await cursor.next();

    expect(Comlink.transfer).toHaveBeenCalledWith(input, [buffer]);
    expect(result).toEqual({
      value: input,
      transferables: [buffer],
    });
  });

  it("does not transfer if next() is 'alert'", async () => {
    const input: IteratorResult<Uint8Array> = {
      type: "alert",
      connectionId: 1,
      alert: { message: "Warning", severity: "warn" },
    };

    mockCursor.next.mockResolvedValueOnce(input);

    const cursor = new ComlinkTransferIteratorCursor(mockCursor);
    const result = await cursor.next();

    expect(Comlink.transfer).not.toHaveBeenCalled();
    expect(result).toBe(input);
  });

  it("transfers multiple message-event buffers in nextBatch()", async () => {
    const buf1 = new Uint8Array([10]).buffer;
    const buf2 = new Uint8Array([20]).buffer;

    const batch: IteratorResult<Uint8Array>[] = [
      {
        type: "message-event",
        msgEvent: { message: new Uint8Array(buf1) } as MessageEvent<Uint8Array>,
      },
      {
        type: "message-event",
        msgEvent: { message: new Uint8Array(buf2) } as MessageEvent<Uint8Array>,
      },
      {
        type: "alert",
        connectionId: 2,
        alert: { message: "Notice" } as any,
      },
    ];

    mockCursor.nextBatch.mockResolvedValueOnce(batch);

    const cursor = new ComlinkTransferIteratorCursor(mockCursor);
    const result = await cursor.nextBatch(100);

    expect(Comlink.transfer).toHaveBeenCalledWith(batch, [buf1, buf2]);
    expect(result).toEqual({
      value: batch,
      transferables: [buf1, buf2],
    });
  });

  it("delegates readUntil()", async () => {
    const time = RosTimeBuilder.time();

    const cursor = new ComlinkTransferIteratorCursor(mockCursor);
    await cursor.readUntil(time);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockCursor.readUntil as jest.MockableFunction).toHaveBeenCalledWith(time);
  });

  it("delegates end()", async () => {
    const cursor = new ComlinkTransferIteratorCursor(mockCursor);
    await cursor.end();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockCursor.end).toHaveBeenCalled();
  });
});
