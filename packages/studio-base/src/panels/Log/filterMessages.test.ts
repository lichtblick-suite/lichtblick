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

import { MessageEvent } from "@foxglove/studio-base/players/types";

import filterMessages from "./filterMessages";
import { LogLevel, Ros1RosgraphMsgs$Log, Ros2RosgraphMsgs$Log } from "./types";

describe("filter", () => {
  const ros1msgs = [
    {
      topic: "/some_topic",
      receiveTime: { sec: 123, nsec: 456 },
      schemaName: "rosgraph_msgs/Log",
      message: {
        msg: "Couldn't find int 83757.",
        level: 2,
        name: "/some_topic",
      },
    },
  ] as MessageEvent<Ros1RosgraphMsgs$Log>[];

  const ros2msgs = [
    {
      topic: "/some_topic",
      receiveTime: { sec: 123, nsec: 456 },
      schemaName: "rcl_interfaces/msg/Log",
      message: {
        msg: "Couldn't find int 83757.",
        level: 30,
        name: "/some_topic",
      },
    },
  ] as MessageEvent<Ros2RosgraphMsgs$Log>[];

  it("should remove when minLogLevel is higher than msg level", () => {
    expect(
      filterMessages(ros1msgs, {
        minLogLevel: 3,
        searchTerms: [],
      }),
    ).toEqual([]);
  });

  it("should filter when minLogLevel is same as msg level", () => {
    expect(
      filterMessages(ros1msgs, {
        minLogLevel: 2,
        searchTerms: [],
      }),
    ).toEqual(ros1msgs);
  });

  it("should map log levels by data source", () => {
    expect(
      filterMessages(ros2msgs, {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
      }),
    ).toEqual(ros2msgs);

    expect(
      filterMessages(ros2msgs, {
        minLogLevel: LogLevel.ERROR,
        searchTerms: [],
      }),
    ).toEqual([]);
  });

  describe("when minLogLevel lower than or equal to msg level", () => {
    const minLogLevel = 1;

    it("should keep when search term is empty", () => {
      expect(
        filterMessages(ros1msgs, {
          minLogLevel,
          searchTerms: ["/some_topic"],
        }),
      ).toEqual(ros1msgs);
    });

    it("should keep when msg name contains search terms", () => {
      expect(
        filterMessages(ros1msgs, {
          minLogLevel,
          searchTerms: ["some"],
        }),
      ).toEqual(ros1msgs);
    });

    it("should keep when msg contains search term", () => {
      expect(
        filterMessages(ros1msgs, {
          minLogLevel,
          searchTerms: ["int"],
        }),
      ).toEqual(ros1msgs);
    });

    it("should remove when msg name doesn't contain any search terms", () => {
      expect(
        filterMessages(ros1msgs, {
          minLogLevel,
          searchTerms: ["random"],
        }),
      ).toEqual([]);
    });

    it("should keep when minLogLevel equals msg level and msg contains search terms", () => {
      expect(
        filterMessages(ros1msgs, {
          minLogLevel: 2,
          searchTerms: ["int", "random"],
        }),
      ).toEqual(ros1msgs);
    });
  });
});
