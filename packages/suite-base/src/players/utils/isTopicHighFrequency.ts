// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";
import { TopicStats } from "@lichtblick/suite-base/players/types";
import { calculateStaticItemFrequency } from "@lichtblick/suite-base/util/calculateStaticItemFrequency";

const FREQUENCY_LIMIT = 60;

export function isTopicHighFrequency(
  topicStats: Map<string, TopicStats>,
  topicName: string,
  duration: Time,
  alertManager: PlayerAlertManager,
): void {
  const topicStat = topicStats.get(topicName);
  const frequency = calculateStaticItemFrequency(
    topicStat?.numMessages ?? 0,
    topicStat?.firstMessageTime,
    topicStat?.lastMessageTime,
    duration,
  );
  if (frequency != undefined && frequency > FREQUENCY_LIMIT) {
    alertManager.addAlert("high-frequency", {
      severity: "warn",
      message: "High frequency topics detected",
      error: new Error(
        `The current data source has one or more topics with message frequency higher than 60Hz, which may impact performance and application memory.`,
      ),
    });
  }
}
