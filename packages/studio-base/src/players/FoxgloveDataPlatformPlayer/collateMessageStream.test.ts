// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";

import collateMessageStream from "./collateMessageStream";

async function gather<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

describe("collateMessageStream", () => {
  it("returns full time range for empty stream", async () => {
    await expect(
      gather(collateMessageStream([], { start: fromSec(0), end: fromSec(1) })),
    ).resolves.toEqual([{ messages: [], range: { start: fromSec(0), end: fromSec(1) } }]);
    await expect(
      gather(collateMessageStream([[]], { start: fromSec(0), end: fromSec(1) })),
    ).resolves.toEqual([{ messages: [], range: { start: fromSec(0), end: fromSec(1) } }]);
  });

  it("handles all messages having same receiveTime", async () => {
    await expect(
      gather(
        collateMessageStream(
          [[{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }]],
          {
            start: fromSec(0),
            end: fromSec(1),
          },
        ),
      ),
    ).resolves.toEqual([
      {
        messages: [{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }],
        range: { start: fromSec(0), end: fromSec(1) },
      },
    ]);
    await expect(
      gather(
        collateMessageStream(
          [
            [
              { topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.5), message: 1, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.5), message: 2, sizeInBytes: 0 },
            ],
          ],
          { start: fromSec(0), end: fromSec(1) },
        ),
      ),
    ).resolves.toEqual([
      {
        messages: [
          { topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.5), message: 1, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.5), message: 2, sizeInBytes: 0 },
        ],
        range: { start: fromSec(0), end: fromSec(1) },
      },
    ]);
  });

  it("handles messages one by one", async () => {
    await expect(
      gather(
        collateMessageStream(
          [
            [{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }],
            [{ topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 }],
            [{ topic: "", receiveTime: fromSec(0.7), message: 2, sizeInBytes: 0 }],
            [{ topic: "", receiveTime: fromSec(0.8), message: 3, sizeInBytes: 0 }],
          ],
          {
            start: fromSec(0),
            end: fromSec(1),
          },
        ),
      ),
    ).resolves.toEqual([
      {
        messages: [{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }],
        range: { start: fromSec(0), end: fromSec(0.6) },
      },
      {
        messages: [{ topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 }],
        range: { start: fromSec(0.6), end: fromSec(0.7) },
      },
      {
        messages: [{ topic: "", receiveTime: fromSec(0.7), message: 2, sizeInBytes: 0 }],
        range: { start: fromSec(0.7), end: fromSec(0.8) },
      },
      {
        messages: [{ topic: "", receiveTime: fromSec(0.8), message: 3, sizeInBytes: 0 }],
        range: { start: fromSec(0.8), end: fromSec(1) },
      },
    ]);
  });

  it("handles non-initial chunk having all same receiveTime", async () => {
    await expect(
      gather(
        collateMessageStream(
          [
            [
              { topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 },
            ],
            [
              { topic: "", receiveTime: fromSec(0.6), message: 2, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 3, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 4, sizeInBytes: 0 },
            ],
          ],
          { start: fromSec(0), end: fromSec(1) },
        ),
      ),
    ).resolves.toEqual([
      {
        messages: [{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }],
        range: { start: fromSec(0), end: fromSec(0.6) },
      },
      {
        messages: [
          { topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 2, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 3, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 4, sizeInBytes: 0 },
        ],
        range: { start: fromSec(0.6), end: fromSec(1) },
      },
    ]);

    await expect(
      gather(
        collateMessageStream(
          [
            [
              { topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 },
            ],
            [
              { topic: "", receiveTime: fromSec(0.6), message: 2, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 3, sizeInBytes: 0 },
              { topic: "", receiveTime: fromSec(0.6), message: 4, sizeInBytes: 0 },
            ],
            [{ topic: "", receiveTime: fromSec(0.7), message: 5, sizeInBytes: 0 }],
          ],
          { start: fromSec(0), end: fromSec(1) },
        ),
      ),
    ).resolves.toEqual([
      {
        messages: [{ topic: "", receiveTime: fromSec(0.5), message: 0, sizeInBytes: 0 }],
        range: { start: fromSec(0), end: fromSec(0.6) },
      },
      {
        messages: [
          { topic: "", receiveTime: fromSec(0.6), message: 1, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 2, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 3, sizeInBytes: 0 },
          { topic: "", receiveTime: fromSec(0.6), message: 4, sizeInBytes: 0 },
        ],
        range: { start: fromSec(0.6), end: fromSec(0.7) },
      },
      {
        messages: [{ topic: "", receiveTime: fromSec(0.7), message: 5, sizeInBytes: 0 }],
        range: { start: fromSec(0.7), end: fromSec(1) },
      },
    ]);
  });
});
