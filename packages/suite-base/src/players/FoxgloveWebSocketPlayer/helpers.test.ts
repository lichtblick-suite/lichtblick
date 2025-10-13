// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StatusLevel } from "@foxglove/ws-protocol";

import {
  checkForHighFrequencyTopics,
  dataTypeToFullName,
  statusLevelToAlertSeverity,
} from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/helpers";
import { CheckForHighFrequencyTopics } from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/types";
import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";
import { isTopicHighFrequency } from "@lichtblick/suite-base/players/utils/isTopicHighFrequency";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

jest.mock("@lichtblick/suite-base/players/utils/isTopicHighFrequency");

describe("dataTypeToFullName", () => {
  it("should convert dataType to include /msg/ on it", () => {
    const message = "unit/test";

    const result = dataTypeToFullName(message);

    expect(result).toBe("unit/msg/test");
  });

  it("should return the message unaltered if it differs from the 'text/text' format", () => {
    const message = BasicBuilder.string();

    const result = dataTypeToFullName(message);

    expect(result).toBe(message);
  });
});

describe("statusLevelToProblemSeverity", () => {
  type StatusLevelToProblemTest = [level: StatusLevel, result: string];

  it.each<StatusLevelToProblemTest>([
    [StatusLevel.INFO, "info"],
    [StatusLevel.WARNING, "warn"],
    [StatusLevel.ERROR, "error"],
  ])("should map StatusLevel %s to result %s", (level, result) => {
    expect(statusLevelToAlertSeverity(level)).toBe(result);
  });
});

describe("checkForHighFrequencyTopics", () => {
  let mockIsTopicHighFrequency: jest.MockedFunction<typeof isTopicHighFrequency>;

  function buildParams(
    override: Partial<CheckForHighFrequencyTopics> = {},
  ): CheckForHighFrequencyTopics {
    return {
      endTime: RosTimeBuilder.time(),
      startTime: RosTimeBuilder.time(),
      topics: PlayerBuilder.topics(),
      topicStats: BasicBuilder.genericMap(PlayerBuilder.topicStats),
      alerts: new PlayerAlertManager(),
      ...override,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTopicHighFrequency = jest.mocked(isTopicHighFrequency);
  });

  describe("Given undefined parameters", () => {
    it("should return early when endTime is undefined", () => {
      // Given
      const input = buildParams({ endTime: undefined });

      // When
      checkForHighFrequencyTopics(input);

      // Then
      expect(mockIsTopicHighFrequency).not.toHaveBeenCalled();
    });

    it("should return early when startTime is undefined", () => {
      // Given
      const input = buildParams({ startTime: undefined });

      // When
      checkForHighFrequencyTopics(input);

      // Then
      expect(mockIsTopicHighFrequency).not.toHaveBeenCalled();
    });

    it("should return early when topics is undefined", () => {
      // Given
      const input = buildParams({ topics: undefined });

      // When
      checkForHighFrequencyTopics(input);

      // Then
      expect(mockIsTopicHighFrequency).not.toHaveBeenCalled();
    });

    it("should return early when topics array is empty", () => {
      // Given
      const input = buildParams({ topics: [] });

      // When
      checkForHighFrequencyTopics(input);

      // Then
      expect(mockIsTopicHighFrequency).not.toHaveBeenCalled();
    });
  });

  describe("Given valid parameters", () => {
    it("should return early when first topic is high frequency", () => {
      // Given
      const input = buildParams({
        endTime: RosTimeBuilder.time({ sec: 60, nsec: 0 }),
        startTime: RosTimeBuilder.time({ sec: 10, nsec: 0 }),
      });

      mockIsTopicHighFrequency.mockReturnValueOnce(true);

      // When
      checkForHighFrequencyTopics(input);

      // Then
      expect(mockIsTopicHighFrequency).toHaveBeenCalledTimes(1);
      expect(mockIsTopicHighFrequency).toHaveBeenCalledWith(
        input.topicStats,
        input.topics![0]!.name,
        { sec: 50, nsec: 0 }, // duration should be subtractTimes(endTime, startTime)
        input.topics![0]!.schemaName,
        input.alerts,
      );
    });
  });
});
