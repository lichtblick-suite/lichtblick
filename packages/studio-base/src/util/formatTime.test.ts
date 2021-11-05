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

import * as formatTime from "./formatTime";

describe("formatTime.format", () => {
  it("formats date and time based on provided timezone", () => {
    expect(formatTime.format({ sec: 1, nsec: 0 }, "Asia/Bangkok")).toBe(
      "1970-01-01 7:00:01.000 AM +07",
    );
    expect(formatTime.format({ sec: 1, nsec: 1 }, "Australia/Currie")).toBe(
      "1970-01-01 11:00:01.000 AM AEDT",
    );
    expect(formatTime.format({ sec: 1000000, nsec: 0 }, "Pacific/Midway")).toBe(
      "1970-01-12 2:46:40.000 AM SST",
    );
    expect(formatTime.format({ sec: 1100000, nsec: 1000000000 }, "America/Los_Angeles")).toBe(
      "1970-01-13 9:33:21.000 AM PST",
    );
  });
});

describe("formatTime.formatDate", () => {
  it("formats date based on provided timezone", () => {
    expect(formatTime.formatDate({ sec: 1, nsec: 0 }, "Asia/Bangkok")).toBe("1970-01-01");
    expect(formatTime.formatDate({ sec: 1, nsec: 1 }, "Australia/Currie")).toBe("1970-01-01");
    expect(formatTime.formatDate({ sec: 1000000, nsec: 0 }, "Pacific/Midway")).toBe("1970-01-12");
    expect(formatTime.formatDate({ sec: 1100000, nsec: 1000000000 }, "America/Los_Angeles")).toBe(
      "1970-01-13",
    );
  });
});

describe("formatTime.formatDuration", () => {
  it("uses milliseconds and pads values with zeros", () => {
    expect(formatTime.formatDuration({ sec: 0, nsec: 0 })).toEqual("0:00:00.000");
    expect(formatTime.formatDuration({ sec: 0, nsec: 999 })).toEqual("0:00:00.000");
    expect(formatTime.formatDuration({ sec: 0, nsec: 1000 })).toEqual("0:00:00.000");
    expect(formatTime.formatDuration({ sec: 0, nsec: 499999 })).toEqual("0:00:00.000");
    expect(formatTime.formatDuration({ sec: 0, nsec: 500000 })).toEqual("0:00:00.001");
    expect(formatTime.formatDuration({ sec: 0, nsec: 999e3 })).toEqual("0:00:00.001");
    expect(formatTime.formatDuration({ sec: 0, nsec: 999e6 })).toEqual("0:00:00.999");
    expect(formatTime.formatDuration({ sec: 1, nsec: 999e6 })).toEqual("0:00:01.999");
    expect(formatTime.formatDuration({ sec: 1, nsec: 999999e3 })).toEqual("0:00:02.000");
    expect(formatTime.formatDuration({ sec: 1, nsec: 999999999 })).toEqual("0:00:02.000");
    expect(formatTime.formatDuration({ sec: 3 * 60 * 60 + 2 * 60 + 1, nsec: 999e6 })).toEqual(
      "3:02:01.999",
    );
    expect(formatTime.formatDuration({ sec: 3 * 60 * 60 + 59 * 60 + 59, nsec: 99e6 })).toEqual(
      "3:59:59.099",
    );
    expect(formatTime.formatDuration({ sec: -1, nsec: 0 })).toEqual("-0:00:01.000");
    expect(formatTime.formatDuration({ sec: 0, nsec: -1000000 })).toEqual("-0:00:00.001");
  });
});

describe("formatTime.formatTime", () => {
  it("formats time based on provided timezone", () => {
    expect(formatTime.formatTime({ sec: 1, nsec: 0 }, "America/Phoenix")).toBe(
      "5:00:01.000 PM MST",
    );
    expect(formatTime.formatTime({ sec: 1, nsec: 1 }, "America/Detroit")).toBe(
      "7:00:01.000 PM EST",
    );
    expect(formatTime.formatTime({ sec: 1, nsec: 999999999 }, "America/Phoenix")).toBe(
      "5:00:01.999 PM MST",
    );
    expect(formatTime.formatTime({ sec: 1, nsec: 1000000000 }, "America/Los_Angeles")).toBe(
      "4:00:02.000 PM PST",
    );
  });
});

describe("formatTime.parseTimeStr", () => {
  it("returns undefined if the input string is formatted incorrectly", () => {
    expect(formatTime.parseTimeStr("")).toEqual(undefined);
    expect(formatTime.parseTimeStr("018-07")).toEqual(undefined);
    expect(formatTime.parseTimeStr("0")).toEqual(undefined);
  });

  it("returns the correct time with no time zone specified", () => {
    const originalTime = { sec: 1532382320, nsec: 317124567 };
    const timeStr = `${formatTime.formatDate(originalTime)} ${formatTime.formatTime(originalTime)}`;
    expect(formatTime.parseTimeStr(timeStr)).toEqual({
      nsec: 317000000, // time string loses precision
      sec: 1532382320,
    });
  });

  it("returns the correct time with time zone specified", () => {
    const timeStr = "2018-07-23 2:45:20.317 PM PDT";

    {
      const time = formatTime.parseTimeStr(timeStr, "America/Los_Angeles");
      expect(time).toEqual({ sec: 1532382320, nsec: 317000000 });
    }

    {
      const time = formatTime.parseTimeStr(timeStr, "America/Detroit");
      // 3 hours ahead results in seconds value 10800 less than America/Los_Angeles seconds value
      expect(time).toEqual({ sec: 1532371520, nsec: 317000000 });
    }
  });
});

describe("formatTime.getValidatedTimeAndMethodFromString", () => {
  const commonArgs = { date: "2020-01-01", timezone: "America/Los_Angeles" };
  it("takes a string and gets a validated ROS or TOD time", () => {
    expect(formatTime.getValidatedTimeAndMethodFromString({ ...commonArgs, text: "" })).toEqual(
      undefined,
    );
    expect(formatTime.getValidatedTimeAndMethodFromString({ ...commonArgs, text: "abc" })).toEqual(
      undefined,
    );
    expect(
      formatTime.getValidatedTimeAndMethodFromString({ ...commonArgs, text: "123abc" }),
    ).toEqual(undefined);
    expect(
      formatTime.getValidatedTimeAndMethodFromString({
        ...commonArgs,
        text: "1598635994.000000000",
      }),
    ).toEqual({
      time: { nsec: 0, sec: 1598635994 },
      method: "SEC",
    });
    expect(
      formatTime.getValidatedTimeAndMethodFromString({ ...commonArgs, text: "1:30:10.000 PM PST" }),
    ).toEqual({
      time: { nsec: 0, sec: 1577914210 },
      method: "TOD",
    });
  });
});
