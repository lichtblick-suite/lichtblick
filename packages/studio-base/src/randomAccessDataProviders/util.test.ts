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

import { toSec } from "@foxglove/rostime";
import { RandomAccessDataProviderStall } from "@foxglove/studio-base/randomAccessDataProviders/types";

import { mockExtensionPoint } from "./mockExtensionPoint";
import { debounceReduce, getReportMetadataForChunk } from "./util";

jest.useFakeTimers();

describe("getReportMetadataForChunk", () => {
  let mockDateNow: jest.MockedFunction<() => number>;
  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(0) as jest.MockedFunction<() => number>;
  });
  afterEach(() => {
    mockDateNow.mockRestore();
  });

  it("logs a stall", async () => {
    const { metadata, extensionPoint } = mockExtensionPoint();
    let time = 0;
    const waitUntil = (t: any) => {
      const delayDuration = t - time;
      if (delayDuration < 0) {
        throw new Error(`It's past ${t} already`);
      }
      mockDateNow.mockReturnValue(mockDateNow() + delayDuration);
      jest.advanceTimersByTime(delayDuration);
      time = t;
    };
    const reportMetadataForChunk = getReportMetadataForChunk(extensionPoint, 100);
    // Should not result in a stall
    waitUntil(200);

    reportMetadataForChunk(Buffer.allocUnsafe(100));
    waitUntil(250);
    reportMetadataForChunk(Buffer.allocUnsafe(100));
    waitUntil(300);
    reportMetadataForChunk(Buffer.allocUnsafe(100));
    waitUntil(500);
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
  let mockDateNow: jest.MockedFunction<() => number>;
  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(0) as jest.MockedFunction<() => number>;
  });
  afterEach(() => {
    mockDateNow.mockRestore();
  });

  it("combines calls that happen closely together", async () => {
    const totals: Array<number> = [];
    const time = 0;
    const waitUntil = (t: number) => {
      if (time > t) {
        throw new Error(`It's past ${t} already`);
      }
      mockDateNow.mockReturnValue(mockDateNow() + t - time);
      jest.advanceTimersByTime(t - time);
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
    waitUntil(1);
    expect(totals).toEqual([1]);

    fn(new ArrayBuffer(2));
    waitUntil(90);
    expect(totals).toEqual([1]); // not yet
    fn(new ArrayBuffer(3));
    waitUntil(110);
    expect(totals).toEqual([1, 5]); // combines writes

    waitUntil(300);
    expect(totals).toEqual([1, 5]); // no extra writes
  });
});
