// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { Time } from "@lichtblick/suite";
import formatMessages from "@lichtblick/suite-base/panels/Log/formatMessages";
import { NormalizedLogMessage } from "@lichtblick/suite-base/panels/Log/types";
import { formatTime } from "@lichtblick/suite-base/util/formatTime";

describe("formatMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should format a log message correctly", () => {
    const stamp: Time = {
      sec: 1672531200,
      nsec: 0,
    };

    const item: NormalizedLogMessage = {
      level: 2,
      stamp,
      name: "TestLogger",
      message: "This is a test message",
    };
    const formattedTime = formatTime(stamp);
    const formatted = formatMessages([item]);
    expect(formatted).toEqual([`[INFO] [${formattedTime}] [${item.name}] ${item.message}`]);
  });

  it("should format a log message without name attribute", () => {
    const stamp: Time = {
      sec: 1672531200,
      nsec: 0,
    };

    const item: NormalizedLogMessage = {
      level: 4,
      stamp,
      name: "",
      message: "This is a test message with no name",
    };
    const formattedTime = formatTime(stamp);
    const formatted = formatMessages([item]);
    expect(formatted).toEqual([`[ERROR] [${formattedTime}] [] ${item.message}`]);
  });
});
