// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import { TopicStats } from "@lichtblick/suite-base/players/types";
import { FREQUENCY_LIMIT, LOG_SCHEMAS } from "@lichtblick/suite-base/players/utils/constants";
import { calculateStaticItemFrequency } from "@lichtblick/suite-base/util/calculateStaticItemFrequency";

function isLogSchema(schemaName?: string): boolean {
  return schemaName != undefined && LOG_SCHEMAS.has(schemaName);
}

export function isTopicHighFrequency(
  topicStats: Map<string, TopicStats>,
  topicName: string,
  duration: Time,
  schemaName: string | undefined,
): boolean {
  if (isLogSchema(schemaName)) {
    return false;
  }

  const topicStat = topicStats.get(topicName);
  const frequency = calculateStaticItemFrequency(
    topicStat?.numMessages ?? 0,
    topicStat?.firstMessageTime,
    topicStat?.lastMessageTime,
    duration,
  );

  if (frequency != undefined && frequency > FREQUENCY_LIMIT) {
    return true;
  }

  return false;
}
