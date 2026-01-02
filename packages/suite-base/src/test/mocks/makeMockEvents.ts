// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { add, toNanoSec, toSec } from "@lichtblick/rostime";
import { TimelinePositionedEvent } from "@lichtblick/suite-base/context/EventsContext";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

export function makeMockEvents(
  count: number,
  startSec: number = 100,
  stepSec: number = 1,
): TimelinePositionedEvent[] {
  return _.range(0, count).map((idx) => {
    const startTime = RosTimeBuilder.time({ sec: idx * stepSec + startSec, nsec: 0 });
    const duration = RosTimeBuilder.time({ sec: (idx % 3) + 1, nsec: 0 });

    return {
      event: {
        id: `event_${idx + 1}`,
        endTime: RosTimeBuilder.time(add(startTime, duration)),
        endTimeInSeconds: toSec(RosTimeBuilder.time(add(startTime, duration))),
        startTime,
        startTimeInSeconds: toSec(startTime),
        timestampNanos: toNanoSec(startTime).toString(),
        metadata: {
          type: BasicBuilder.strings()[idx % 3]!,
          state: BasicBuilder.strings()[idx % 3]!,
        },
        createdAt: BasicBuilder.datetime(),
        updatedAt: BasicBuilder.datetime(),
        deviceId: `device_${idx + 1}`,
        durationNanos: toNanoSec(duration).toString(),
      },
      startPosition: idx / count,
      endPosition: idx / count + 0.1,
      secondsSinceStart: toSec(startTime),
    };
  });
}
