// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathStructureItemMessage } from "@lichtblick/message-path/src/types";
import { messagePathsForStructure } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { MessagePathsForStructure } from "@lichtblick/suite-base/components/MessagePathSyntax/types";
import { Topic } from "@lichtblick/suite-base/players/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

import { structureAllItemsByPath } from "./structureAllItemsByPath";

jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype", () => ({
  messagePathsForStructure: jest.fn(() => []),
}));

describe("structureAllItemsByPath", () => {
  let mockNoMultiSlices: boolean;
  let mockValidTypes: string[];
  let mockTopics: Topic[];
  const mockMessagePathStructureItemMessage: MessagePathStructureItemMessage = {
    structureType: "message",
    datatype: BasicBuilder.string(),
    nextByName: {
      property: {
        structureType: "primitive",
        primitiveType: "string",
        datatype: "string",
      },
    },
  };

  let mockMessagePathStructuresForDataype: Record<string, MessagePathStructureItemMessage>;

  beforeEach(() => {
    mockMessagePathStructuresForDataype = {};
    mockNoMultiSlices = BasicBuilder.boolean();
    mockValidTypes = BasicBuilder.multiple(BasicBuilder.string, BasicBuilder.number());
    mockTopics = BasicBuilder.multiple(PlayerBuilder.topic, BasicBuilder.number());
  });

  const populateMockMessagePathStructuresForDataype = () => {
    mockTopics.forEach((topic) => {
      if (topic.schemaName) {
        mockMessagePathStructuresForDataype[topic.schemaName] = mockMessagePathStructureItemMessage;
      }
    });
  };

  it("should skip topics that have no schemaName and not include them in the resulting Map", () => {
    const schemaNamelessTopic = PlayerBuilder.topic();
    schemaNamelessTopic.schemaName = undefined;

    const mockTopics1 = [schemaNamelessTopic];

    const result = structureAllItemsByPath({
      noMultiSlices: mockNoMultiSlices,
      validTypes: mockValidTypes,
      messagePathStructuresForDataype: mockMessagePathStructuresForDataype,
      topics: mockTopics1,
    });

    expect(result.size).toBe(0);
  });

  it("should skip topics with unknown or missing structure in messagePathStructuresForDataype", () => {
    mockMessagePathStructuresForDataype = {
      [BasicBuilder.string()]: mockMessagePathStructureItemMessage,
    };

    const result = structureAllItemsByPath({
      noMultiSlices: mockNoMultiSlices,
      validTypes: mockValidTypes,
      messagePathStructuresForDataype: mockMessagePathStructuresForDataype,
      topics: mockTopics,
    });

    expect(result.size).toBe(0);
  });

  it("should return correct structure with valid input", () => {
    populateMockMessagePathStructuresForDataype();

    (messagePathsForStructure as jest.Mock).mockImplementation(
      (): MessagePathsForStructure => [
        {
          path: ".property",
          terminatingStructureItem: mockMessagePathStructureItemMessage.nextByName.property!,
        },
        {
          path: ".property_2",
          terminatingStructureItem: mockMessagePathStructureItemMessage.nextByName.property!,
        },
      ],
    );

    const result = structureAllItemsByPath({
      noMultiSlices: mockNoMultiSlices,
      validTypes: mockValidTypes,
      messagePathStructuresForDataype: mockMessagePathStructuresForDataype,
      topics: mockTopics,
    });

    // Each topic should yield two paths: one for .property and another for .property_2
    expect(result.size).toBe(mockTopics.length * 2);
  });

  it("should return correct structure removing duplicated and empty item.paths", () => {
    populateMockMessagePathStructuresForDataype();

    (messagePathsForStructure as jest.Mock).mockImplementation(
      (): MessagePathsForStructure => [
        {
          path: ".property",
          terminatingStructureItem: mockMessagePathStructureItemMessage.nextByName.property!,
        },
        {
          path: ".property", // Duplicated should be ignored
          terminatingStructureItem: mockMessagePathStructureItemMessage.nextByName.property!,
        },
        {
          path: "", // Empty path should be ignored
          terminatingStructureItem: mockMessagePathStructureItemMessage.nextByName.property!,
        },
      ],
    );

    const result = structureAllItemsByPath({
      noMultiSlices: mockNoMultiSlices,
      validTypes: mockValidTypes,
      messagePathStructuresForDataype: mockMessagePathStructuresForDataype,
      topics: mockTopics,
    });

    // Each topic should yield only one paths, for .property. For the second .property and the empty, it should be ignored.
    expect(result.size).toBe(mockTopics.length);
  });
});
