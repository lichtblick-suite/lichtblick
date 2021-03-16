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

import delay from "@foxglove-studio/app/shared/delay";
import { toSec } from "@foxglove-studio/app/util/time";

import { mockExtensionPoint } from "./mockExtensionPoint";
import { getReportMetadataForChunk } from "./util";

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
    const stall = stalls[0];
    // Stall happened from 300ms until 500ms. First byte received at 200ms.
    if (stall.type !== "data_provider_stall") {
      throw new Error("Satisfy flow that stall is a DataProviderStall");
    }
    expect(stall.bytesReceivedBeforeStall).toEqual(300);
    expect(toSec(stall.requestTimeUntilStall)).toBeCloseTo(0.3, 1);
    expect(toSec(stall.stallDuration)).toBeCloseTo(0.2, 1);
    expect(toSec(stall.transferTimeUntilStall)).toBeCloseTo(0.1, 1);
  });
});
