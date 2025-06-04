// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { Initialization } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { OptionalMessageDefinition } from "@lichtblick/suite-base/types/RosDatatypes";

/**
 * Validates that topics maintain a consistent datatype across all MCAPs.
 *
 * - If a topic already exists in `accumulated` but has a different datatype,
 *   a warning is added to `accumulated.alerts`.
 * - If the topic is new, it is safe to add it to the `accumulated` map.
 */
export const validateAndAddNewDatatypes = (
  accumulated: Initialization,
  current: Initialization,
): void => {
  const isSameDatatype = (a: OptionalMessageDefinition, b: OptionalMessageDefinition): boolean => {
    return _.isEqual(a.definitions, b.definitions);
  };

  for (const [datatype, currentDefinition] of current.datatypes) {
    const accumulatedDefinition = accumulated.datatypes.get(datatype);

    if (!accumulatedDefinition) {
      accumulated.datatypes.set(datatype, currentDefinition);
      continue;
    }

    if (!isSameDatatype(accumulatedDefinition, currentDefinition)) {
      accumulated.alerts.push({
        message: `Different datatypes found for schema "${datatype}"`,
        severity: "warn",
        tip: "Ensure all MCAPs use the same schema for each datatype. Merging files may cause issues in visualization.",
      });
    }
  }
};

/**
 * Validates and accumulates topics, ensuring unique topic names with consistent schemaNames.
 */
export const validateAndAddNewTopics = (
  accumulated: Initialization,
  current: Initialization,
): void => {
  for (const topic of current.topics) {
    const existingTopic = accumulated.topics.find((t) => t.name === topic.name);

    if (!existingTopic) {
      accumulated.topics.push(topic);
      continue;
    }

    if (existingTopic.schemaName !== topic.schemaName) {
      accumulated.alerts.push({
        message: `Schema name mismatch detected for topic "${topic.name}". Expected "${existingTopic.schemaName}", but found "${topic.schemaName}".`,
        severity: "warn",
        tip: "Ensure all MCAPs use a consistent schema for this topic.",
      });
    }
  }
};
