// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { subtract, areEqual, Time, toSec } from "@lichtblick/rostime";

export function calculateStaticItemFrequency(
  numMessages: number,
  firstMessageTime: undefined | Time,
  lastMessageTime: undefined | Time,
  duration: Time,
): undefined | number {
  // Message count but no timestamps, use the full connection duration
  if (firstMessageTime == undefined || lastMessageTime == undefined) {
    const durationSec = toSec(duration);
    if (durationSec > 0) {
      return numMessages / durationSec;
    } else {
      return undefined;
    }
  }

  // Not enough messages or time span to calculate a frequency
  if (numMessages < 2 || areEqual(firstMessageTime, lastMessageTime)) {
    return undefined;
  }

  const topicDurationSec = toSec(subtract(lastMessageTime, firstMessageTime));
  if (topicDurationSec > 0) {
    return (numMessages - 1) / topicDurationSec;
  } else {
    return undefined;
  }
}
