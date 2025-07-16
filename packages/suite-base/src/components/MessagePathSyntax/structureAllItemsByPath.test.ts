// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathStructureItemMessage } from "@lichtblick/message-path/src/types";
import { Topic } from "@lichtblick/suite-base/players/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import TopicBuilder from "@lichtblick/suite-base/testing/builders/TopicBuilder";

import { structureAllItemsByPath } from "./structureAllItemsByPath";

describe("structureAllItemsByPath", () => {
  let mockNoMultiSlices: boolean;
  let mockValidTypes: string[];
  let mockTopics: Topic[];
  const mockMessagePathStructureItemMessage: MessagePathStructureItemMessage = {
    structureType: "message",
    datatype: "TestMessage",
    nextByName: {
      name: {
        structureType: "primitive",
        primitiveType: "string",
        datatype: "string",
      },
    },
  };

  const mockMessagePathStructuresForDataype: Record<string, MessagePathStructureItemMessage> = {
    test: mockMessagePathStructureItemMessage,
  };

  beforeEach(() => {
    mockNoMultiSlices = BasicBuilder.boolean();
    mockValidTypes = BasicBuilder.multiple(BasicBuilder.string, BasicBuilder.number());
    mockTopics = BasicBuilder.multiple(TopicBuilder.topic, BasicBuilder.number());
  });

  it("test", () => {
    const schemaNamelessTopic = TopicBuilder.topic();
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
});
