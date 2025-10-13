// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RosTime } from "@lichtblick/suite-base/panels/ThreeDeeRender/ros";
import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";
import { TopicStats } from "@lichtblick/suite-base/players/types";
import { isTopicHighFrequency } from "@lichtblick/suite-base/players/utils/isTopicHighFrequency";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

describe("isTopicHighFrequency", () => {
  const topicName = BasicBuilder.string();
  const alertManager = new PlayerAlertManager();
  const topicStats = new Map<string, TopicStats>([
    [topicName, { numMessages: BasicBuilder.number() }],
  ]);
  const duration: RosTime = { sec: 30, nsec: 15 };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shouldn't create an alert when there aren't topics with high message frequency", () => {
    const alertManagerSpy = jest.spyOn(alertManager, "addAlert");
    isTopicHighFrequency(topicStats, topicName, duration, alertManager);

    expect(alertManagerSpy).not.toHaveBeenCalled();
  });

  it("should create an alert when there are topics with high message frequency", () => {
    const alertManagerSpy = jest.spyOn(alertManager, "addAlert");
    const highFrequencyTopicName = BasicBuilder.string();
    const topicStatsHighFrequency = new Map<string, TopicStats>([
      [highFrequencyTopicName, { numMessages: BasicBuilder.number({ min: 2000, max: 4000 }) }],
    ]);

    isTopicHighFrequency(topicStatsHighFrequency, highFrequencyTopicName, duration, alertManager);

    expect(alertManagerSpy).toHaveBeenCalled();
  });
});
