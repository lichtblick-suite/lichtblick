// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Initialization } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import InitilizationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitilizationSourceBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import RosDatatypesBuilder from "@lichtblick/suite-base/testing/builders/RosDatatypesBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { validateAndAddNewDatatypes, validateAndAddNewTopics } from "./validateInitialization";

describe("validateInitialization", () => {
  let accumulated: Initialization;
  let current: Initialization;

  beforeEach(() => {
    accumulated = InitilizationSourceBuilder.initialization();
    current = InitilizationSourceBuilder.initialization();
  });

  describe("validateAndAddDatatypes", () => {
    it("should add a warning if there is a datatype mismatch", () => {
      const datatype = BasicBuilder.string();
      const accumulatedDefinition = RosDatatypesBuilder.optionalMessageDefinition();
      const currentDefinition = RosDatatypesBuilder.optionalMessageDefinition();
      accumulated.datatypes.set(datatype, accumulatedDefinition);
      current.datatypes.set(datatype, currentDefinition);

      validateAndAddNewDatatypes(accumulated, current);

      expect(accumulated.datatypes.get(datatype)).toEqual(accumulatedDefinition);
      expect(accumulated.alerts).toHaveLength(1);
      expect(accumulated.alerts[0]!.message).toBe(
        `Different datatypes found for schema "${datatype}"`,
      );
    });

    it("should not add a warning if datatypes are consistent", () => {
      const datatype = BasicBuilder.string();
      const definition = RosDatatypesBuilder.optionalMessageDefinition();
      accumulated.datatypes.set(datatype, definition);
      current.datatypes.set(datatype, definition);

      validateAndAddNewDatatypes(accumulated, current);

      expect(accumulated.alerts).toHaveLength(0);
      expect(accumulated.datatypes.get(datatype)).toEqual(definition);
    });

    it("should not add a warning for new datatypes", () => {
      const datatype = BasicBuilder.string();
      const definition = RosDatatypesBuilder.optionalMessageDefinition();
      current.datatypes.set(datatype, definition);

      validateAndAddNewDatatypes(accumulated, current);

      expect(accumulated.alerts).toHaveLength(0);
      expect(accumulated.datatypes.get(datatype)).toEqual(definition);
    });

    describe("validateAndAddTopics", () => {
      it("should add a warning if there is a schema name mismatch", () => {
        const topicName = BasicBuilder.string();
        const accumulatedTopic = PlayerBuilder.topic({ name: topicName });
        const currentTopic = PlayerBuilder.topic({ name: topicName });
        accumulated.topics.push(accumulatedTopic);
        current.topics.push(currentTopic);

        validateAndAddNewTopics(accumulated, current);

        expect(accumulated.topics).toEqual([accumulatedTopic]);
        expect(accumulated.alerts).toHaveLength(1);
        expect(accumulated.alerts[0]!.message).toBe(
          `Schema name mismatch detected for topic "${topicName}". Expected "${accumulatedTopic.schemaName}", but found "${currentTopic.schemaName}".`,
        );
      });

      it("should not add a warning if schema names are consistent", () => {
        const topic = PlayerBuilder.topic();
        accumulated.topics.push(topic);
        current.topics.push(topic);

        validateAndAddNewTopics(accumulated, current);

        expect(accumulated.alerts).toHaveLength(0);
        expect(accumulated.topics).toEqual([topic]);
      });

      it("should not add a warning for new topics", () => {
        const topic = PlayerBuilder.topic();
        accumulated.topics = [];
        current.topics.push(topic);

        validateAndAddNewTopics(accumulated, current);

        expect(accumulated.topics).toEqual([topic]);
        expect(accumulated.alerts).toHaveLength(0);
      });

      it("should add all topics for multiple topics per MCAP", () => {
        const topics = PlayerBuilder.topics(4);
        const topic1 = topics[0]!;
        const topic2 = topics[1]!;
        const topic3 = topics[2]!;
        const topic4 = topics[3]!;
        const topic5 = topic4;
        accumulated.topics = [];
        current.topics = [topic1, topic2];

        validateAndAddNewTopics(accumulated, current);

        current.topics = [topic3, topic4, topic5];
        validateAndAddNewTopics(accumulated, current);

        expect(accumulated.topics).toEqual([topic1, topic2, topic3, topic4]);
        expect(accumulated.alerts).toHaveLength(0);
      });
    });
  });
});
