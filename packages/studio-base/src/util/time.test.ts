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

import { MessageEvent } from "@foxglove/studio";

import * as time from "./time";

describe("time.formatTimeRaw", () => {
  it("formats whole values correction", () => {
    expect(time.formatTimeRaw({ sec: 1, nsec: 0 })).toEqual("1.000000000");
  });

  it("formats partial nanos", () => {
    expect(time.formatTimeRaw({ sec: 102, nsec: 304 })).toEqual("102.000000304");
    expect(time.formatTimeRaw({ sec: 102, nsec: 99900000 })).toEqual("102.099900000");
  });

  it("formats max nanos", () => {
    expect(time.formatTimeRaw({ sec: 102, nsec: 999000000 })).toEqual("102.999000000");
  });

  it("does not format negative times", () => {
    expect(time.formatTimeRaw({ sec: -1, nsec: 0 })).toEqual("(invalid negative time)");
    expect(console.error).toHaveBeenCalled();
    (console.error as jest.Mock).mockClear();
  });
});

describe("time.getTimestampForMessageEvent", () => {
  it("uses headerStamp when available", () => {
    const messageBase: Omit<MessageEvent<unknown>, "message"> = {
      topic: "/foo",
      receiveTime: { sec: 1000, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "stamped",
    };

    expect(
      time.getTimestampForMessageEvent(
        {
          ...messageBase,
          message: { header: { stamp: { sec: 123, nsec: 456 }, seq: 0, frame_id: "" } },
        },
        "headerStamp",
      ),
    ).toEqual({ sec: 123, nsec: 456 });
    expect(
      time.getTimestampForMessageEvent(
        {
          ...messageBase,
          message: {
            header: { stamp: { sec: 0, nsec: 0 }, seq: 0, frame_id: "" },
          },
        },
        "headerStamp",
      ),
    ).toEqual({ sec: 0, nsec: 0 });
    expect(
      time.getTimestampForMessageEvent({ ...messageBase, message: {} }, "headerStamp"),
    ).toEqual(undefined);
  });
});
