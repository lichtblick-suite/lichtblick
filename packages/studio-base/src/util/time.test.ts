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

describe("time.findClosestTimestampIndex", () => {
  it("returns 0 for value before the first timestamp", () => {
    expect(time.findClosestTimestampIndex({ sec: 1, nsec: 0 }, ["2", "3"])).toEqual(0);
  });

  it("returns last timestamp index for value after the last timestamp", () => {
    expect(time.findClosestTimestampIndex({ sec: 11, nsec: 0 }, ["2", "3"])).toEqual(1);
  });

  it("returns -1 for empty timestamps", () => {
    expect(time.findClosestTimestampIndex({ sec: 1, nsec: 0 })).toEqual(-1);
  });

  it("returns the correct timestamp index on the lower bound", () => {
    expect(time.findClosestTimestampIndex({ sec: 1, nsec: 0 }, ["1", "2"])).toEqual(0);
    expect(time.findClosestTimestampIndex({ sec: 1, nsec: 999999999 }, ["1", "2"])).toEqual(0);
    expect(time.findClosestTimestampIndex({ sec: 2, nsec: 999999999 }, ["1", "2", "3"])).toEqual(1);
  });
});

describe("time.parseRosTimeStr", () => {
  it("returns undefined if the input string is formatted incorrectly", () => {
    expect(time.parseRosTimeStr("")).toEqual(undefined);
    expect(time.parseRosTimeStr(".12121")).toEqual(undefined);
    expect(time.parseRosTimeStr(".")).toEqual(undefined);
  });

  it("returns the correct time", () => {
    expect(time.parseRosTimeStr("12121.")).toEqual({ sec: 12121, nsec: 0 });
    expect(time.parseRosTimeStr("1")).toEqual({ sec: 1, nsec: 0 });
    expect(time.parseRosTimeStr("1.")).toEqual({ sec: 1, nsec: 0 });
    expect(time.parseRosTimeStr("1.12")).toEqual({ sec: 1, nsec: 0.12e9 });
    expect(time.parseRosTimeStr("100.100")).toEqual({ sec: 100, nsec: 0.1e9 });
    expect(time.parseRosTimeStr("100")).toEqual({ sec: 100, nsec: 0 });
    // Full nanosecond timestamp
    expect(time.parseRosTimeStr("1.123456789")).toEqual({ sec: 1, nsec: 0.123456789e9 });
    // Too much precision
    expect(time.parseRosTimeStr("1.0123456789")).toEqual({ sec: 1, nsec: 0.012345679e9 });
    // Too much precision, round seconds up.
    expect(time.parseRosTimeStr("1.999999999999")).toEqual({ sec: 2, nsec: 0 });
  });
});

describe("time.getTimestampForMessageEvent", () => {
  it("uses headerStamp when available", () => {
    const messageBase = {
      topic: "/foo",
      receiveTime: { sec: 1000, nsec: 0 },
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
          message: { header: { stamp: { sec: 0, nsec: 0 }, seq: 0, frame_id: "" } },
        },
        "headerStamp",
      ),
    ).toEqual({ sec: 0, nsec: 0 });
    expect(
      time.getTimestampForMessageEvent({ ...messageBase, message: {} }, "headerStamp"),
    ).toEqual(undefined);
  });
});

describe("time.getSeekTimeFromSpec", () => {
  it("returns absolute seek times", () => {
    expect(
      time.getSeekTimeFromSpec(
        { type: "absolute", time: { sec: 12, nsec: 0 } },
        { sec: 10, nsec: 0 },
        { sec: 15, nsec: 0 },
      ),
    ).toEqual({ sec: 12, nsec: 0 });
  });

  it("adds relative offsets", () => {
    expect(
      time.getSeekTimeFromSpec(
        { type: "relative", startOffset: { sec: 1, nsec: 0 } },
        { sec: 10, nsec: 0 },
        { sec: 15, nsec: 0 },
      ),
    ).toEqual({ sec: 11, nsec: 0 });
  });

  it("supports negative relative offsets", () => {
    expect(
      time.getSeekTimeFromSpec(
        { type: "relative", startOffset: { sec: -1, nsec: 5e8 } }, // minus half a second
        { sec: 10, nsec: 0 },
        { sec: 15, nsec: 0 },
      ),
    ).toEqual({ sec: 14, nsec: 5e8 });
  });

  it("calculates fractional times", () => {
    expect(
      time.getSeekTimeFromSpec(
        { type: "fraction", fraction: 0.6 },
        { sec: 10, nsec: 0 },
        { sec: 15, nsec: 0 },
      ),
    ).toEqual({ sec: 13, nsec: 0 });
  });

  it("clamps seek times to the playback range", () => {
    const start = { sec: 10, nsec: 0 };
    const end = { sec: 15, nsec: 0 };
    expect(
      time.getSeekTimeFromSpec({ type: "absolute", time: { sec: 6, nsec: 0 } }, start, end),
    ).toEqual(start);
    expect(
      time.getSeekTimeFromSpec({ type: "absolute", time: { sec: 16, nsec: 0 } }, start, end),
    ).toEqual(end);

    expect(
      time.getSeekTimeFromSpec({ type: "relative", startOffset: { sec: -6, nsec: 0 } }, start, end),
    ).toEqual(start);
    expect(
      time.getSeekTimeFromSpec({ type: "relative", startOffset: { sec: 6, nsec: 0 } }, start, end),
    ).toEqual(end);

    expect(time.getSeekTimeFromSpec({ type: "fraction", fraction: -1 }, start, end)).toEqual(start);
    expect(time.getSeekTimeFromSpec({ type: "fraction", fraction: 2 }, start, end)).toEqual(end);
  });
});
