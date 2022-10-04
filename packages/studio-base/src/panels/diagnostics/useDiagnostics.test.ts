/** @jest-environment jsdom */
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

import { addMessages } from "./useDiagnostics";
import { computeDiagnosticInfo, DiagnosticInfo, DiagnosticStatusArrayMsg, LEVELS } from "./util";

const buildMessageAtLevel = (level: number): MessageEvent<DiagnosticStatusArrayMsg> => ({
  message: {
    status: [
      {
        level,
        name: "MCTM Logger",
        message: "No triggers since launch!",
        hardware_id: "mctm_logger",
        values: [],
      },
    ],
    header: { stamp: { sec: 1547062466, nsec: 1674890 }, frame_id: "", seq: 0 },
  },
  topic: "/foo",
  receiveTime: { sec: 1547062466, nsec: 1674890 },
  datatype: "diagnostic_msgs/Diagnostic",
  sizeInBytes: 0,
});

const diagnosticInfoAtLevel = (level: number): DiagnosticInfo => {
  const { message } = buildMessageAtLevel(level);
  return computeDiagnosticInfo(message.status[0]!, message.header.stamp);
};

describe("addMessages", () => {
  it("adds a message at the right warning level", () => {
    const message = buildMessageAtLevel(LEVELS.OK);
    const info = diagnosticInfoAtLevel(LEVELS.OK);
    expect(addMessages(new Map(), [message])).toEqual(
      new Map([[info.status.hardware_id, new Map([[info.status.name, info]])]]),
    );
  });

  it("can move a message from one level to another", () => {
    const message1 = buildMessageAtLevel(LEVELS.OK);
    const message2 = buildMessageAtLevel(LEVELS.ERROR);
    const info = diagnosticInfoAtLevel(LEVELS.ERROR);
    expect(addMessages(new Map(), [message1, message2])).toEqual(
      new Map([[info.status.hardware_id, new Map([[info.status.name, info]])]]),
    );
  });
});
