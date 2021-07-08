// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { RandomAccessDataProviderStall } from "@foxglove/studio-base/randomAccessDataProviders/types";
import delay from "@foxglove/studio-base/util/delay";
import { toSec } from "@foxglove/studio-base/util/time";

import { mockExtensionPoint } from "./mockExtensionPoint";
import { debounceReduce, getReportMetadataForChunk } from "./util";

describe("getReportMetadataForChunk", () => {
  it("logs a stall", async () => {
    const { metadata, extensionPoint } = mockExtensionPoint();
    let time = 0;
    const waitUntil = async (t: any) => {
      const delayDuration = t - time;
      if (delayDuration < 0) {
        throw new Error(`It's past ${t} already`);
      }
      await delay(delayDuration);
      time = t;
    };
    const reportMetadataForChunk = getReportMetadataForChunk(extensionPoint, 100);
    // Should not result in a stall
    await waitUntil(200);

    reportMetadataForChunk(Buffer.allocUnsafe(100));
    await waitUntil(250);
    reportMetadataForChunk(Buffer.allocUnsafe(100));
    await waitUntil(300);
    reportMetadataForChunk(Buffer.allocUnsafe(100));
    await waitUntil(500);
    reportMetadataForChunk(Buffer.allocUnsafe(100));
    const stalls = metadata.filter(({ type }) => type === "data_provider_stall");
    expect(stalls).toHaveLength(1);
    const stall = stalls[0]! as RandomAccessDataProviderStall;
    expect(stall.bytesReceivedBeforeStall).toEqual(300);
    expect(toSec(stall.requestTimeUntilStall)).toBeCloseTo(0.3, 1);
    expect(toSec(stall.stallDuration)).toBeCloseTo(0.2, 1);
    expect(toSec(stall.transferTimeUntilStall)).toBeCloseTo(0.1, 1);
  });
});

describe("debounceReduce", () => {
  it("combines calls that happen closely together", async () => {
    const totals: Array<number> = [];
    const time = 0;
    const waitUntil = async (t: number) => {
      if (time > t) {
        throw new Error(`It's past ${t} already`);
      }
      return await delay(t - time);
    };
    const fn = debounceReduce({
      action: (n: number) => {
        totals.push(n);
      },
      wait: 100,
      reducer: (n: number, buf: ArrayBuffer) => n + buf.byteLength,
      initialValue: 0,
    });

    fn(new ArrayBuffer(1));
    await waitUntil(1);
    expect(totals).toEqual([1]);

    fn(new ArrayBuffer(2));
    await waitUntil(90);
    expect(totals).toEqual([1]); // not yet
    fn(new ArrayBuffer(3));
    await waitUntil(110);
    expect(totals).toEqual([1, 5]); // combines writes

    await waitUntil(300);
    expect(totals).toEqual([1, 5]); // no extra writes
  });
});
