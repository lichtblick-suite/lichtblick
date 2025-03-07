// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { compare } from "@lichtblick/rostime";
import { Initialization } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { InitLoadedTimes } from "@lichtblick/suite-base/players/IterablePlayer/shared/types";
import { OptionalMessageDefinition } from "@lichtblick/suite-base/types/RosDatatypes";

/**
 * Validates if the current MCAP time range overlaps with previously loaded ranges.
 *
 * Overlap is detected if:
 * - The current MCAP starts or ends within the loaded range.
 * - The current MCAP fully wraps around the loaded range.
 *
 * If an overlap is detected, a warning is added to the `problems` list,
 * indicating potential issues with functionalities relying on non-overlapping time ranges.
 */
export const validateOverlap = (
  loadedTimes: InitLoadedTimes,
  current: Initialization,
  accumulated: Initialization,
): void => {
  for (const loadedTime of loadedTimes) {
    // Check if the current MCAP is after or before the loaded time range
    if (
      compare(current.start, loadedTime.end) >= 0 ||
      compare(current.end, loadedTime.start) <= 0
    ) {
      continue; // No overlap
    }

    // Check if the current MCAP overlaps with the loaded time range
    const startsInside =
      compare(current.start, loadedTime.start) >= 0 && compare(current.start, loadedTime.end) <= 0;
    const endsInside =
      compare(current.end, loadedTime.start) >= 0 && compare(current.end, loadedTime.end) <= 0;
    const fullyInside =
      compare(current.start, loadedTime.start) >= 0 && compare(current.end, loadedTime.end) <= 0;
    const wrappedAround =
      compare(current.start, loadedTime.start) <= 0 && compare(current.end, loadedTime.end) >= 0;

    if (startsInside || endsInside || fullyInside || wrappedAround) {
      accumulated.problems.push({
        message: "MCAP time overlap detected. Some functionalities may not work as expected.",
        severity: "warn",
        tip: "Check the time range of the MCAPs",
      });
      return; // No need to check further once an overlap is detected
    }
  }
};

/**
 * Validates that topics maintain a consistent datatype across all MCAPs.
 *
 * - If a topic already exists in `accumulated` but has a different datatype,
 *   a warning is added to `accumulated.problems`.
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
      accumulated.problems.push({
        message: `Datatype mismatch detected for "${datatype}". Merging may cause issues.`,
        severity: "warn",
        tip: "Ensure all MCAPs use the same schema for each datatype.",
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
      accumulated.problems.push({
        message: `Schema name mismatch detected for topic "${topic.name}". Expected "${existingTopic.schemaName}", but found "${topic.schemaName}".`,
        severity: "warn",
        tip: "Ensure all MCAPs use a consistent schema for this topic.",
      });
    }
  }
};
