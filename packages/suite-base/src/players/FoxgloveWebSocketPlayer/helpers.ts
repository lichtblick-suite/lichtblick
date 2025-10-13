// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StatusLevel } from "@foxglove/ws-protocol";

import { Time } from "@lichtblick/rostime";
import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";
import { subtractTimes } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/time";
import { PlayerAlert, Topic, TopicStats } from "@lichtblick/suite-base/players/types";
import { isTopicHighFrequency } from "@lichtblick/suite-base/players/utils/isTopicHighFrequency";

export function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}

export function statusLevelToAlertSeverity(level: StatusLevel): PlayerAlert["severity"] {
  if (level === StatusLevel.INFO) {
    return "info";
  } else if (level === StatusLevel.WARNING) {
    return "warn";
  } else {
    return "error";
  }
}

export function checkForHighFrequencyTopics(
  endTime: Time | undefined,
  startTime: Time | undefined,
  topics: Topic[] | undefined,
  topicStats: Map<string, TopicStats>,
  alerts: PlayerAlertManager,
): void {
  if (!endTime || !startTime || !topics || topics.length === 0) {
    return;
  }

  const duration = subtractTimes(endTime, startTime);

  for (const topic of topics) {
    const highFrequency = isTopicHighFrequency(
      topicStats,
      topic.name,
      duration,
      topic.schemaName,
      alerts,
    );
    if (highFrequency) {
      return;
    }
  }
}
