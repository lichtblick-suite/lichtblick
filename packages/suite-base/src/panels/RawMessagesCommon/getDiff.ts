// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import * as _ from "lodash-es";

import { isTypicalFilterName } from "@lichtblick/suite-base/components/MessagePathSyntax/isTypicalFilterName";
import { diffArrow } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { diffLabels, DiffObject } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

export const diffLabelsByLabelText = _.keyBy(Object.values(diffLabels), "labelText");

function isValidObjectArray(items: unknown[]): boolean {
  return _.every(items, (item) => typeof item === "object" && item);
}

function getCandidateIdFields(
  firstItem: DiffObject,
): Record<string, { before: unknown[]; after: unknown[] }> {
  const candidates: Record<string, { before: unknown[]; after: unknown[] }> = {};

  if (firstItem.id != undefined) {
    candidates.id = { before: [], after: [] };
  }

  for (const key in firstItem) {
    if (isTypicalFilterName(key)) {
      candidates[key] = { before: [], after: [] };
    }
  }

  return candidates;
}

function collectCandidateValues(
  items: unknown[],
  candidates: Record<string, { before: unknown[]; after: unknown[] }>,
  targetArray: "before" | "after",
): void {
  for (const [idKey, candidateObj] of Object.entries(candidates)) {
    for (const item of items) {
      const value = (item as DiffObject)[idKey];
      if (value != undefined) {
        candidateObj[targetArray].push(value);
      }
    }
  }
}

function isValidIdField(
  candidateIdBefore: unknown[],
  candidateIdAfter: unknown[],
  beforeLength: number,
  afterLength: number,
): boolean {
  return (
    _.uniq(candidateIdBefore).length === beforeLength &&
    _.uniq(candidateIdAfter).length === afterLength
  );
}

function findIdFieldForArrayComparison(before: unknown[], after: unknown[]): string | undefined {
  const allItems = before.concat(after);
  if (typeof allItems[0] !== "object" || allItems[0] == undefined) {
    return undefined;
  }

  if (!isValidObjectArray(allItems)) {
    return undefined;
  }

  const candidateIdsToCompareWith = getCandidateIdFields(allItems[0] as DiffObject);

  collectCandidateValues(before, candidateIdsToCompareWith, "before");
  collectCandidateValues(after, candidateIdsToCompareWith, "after");

  for (const [idKey, { before: candidateIdBefore, after: candidateIdAfter }] of Object.entries(
    candidateIdsToCompareWith,
  )) {
    if (isValidIdField(candidateIdBefore, candidateIdAfter, before.length, after.length)) {
      return idKey;
    }
  }

  return undefined;
}

function isDeletionDiff(diff: DiffObject): boolean {
  const keys = Object.keys(diff);
  return keys.length === 1 && keys[0] === diffLabels.DELETED.labelText;
}

function addIdLabelToDiff(diff: DiffObject, idToCompareWith: string, id: unknown): DiffObject {
  return {
    [diffLabels.ID.labelText]: { [idToCompareWith]: id },
    ...diff,
  };
}

function processDiffForBeforeItem(
  innerDiff: DiffObject,
  idToCompareWith: string,
  id: unknown,
): DiffObject {
  if (isDeletionDiff(innerDiff)) {
    return innerDiff;
  }
  return addIdLabelToDiff(innerDiff, idToCompareWith, id);
}

function diffArraysByIdField(
  before: unknown[],
  after: unknown[],
  idToCompareWith: string,
  { showFullMessageForDiff }: { showFullMessageForDiff: boolean },
): DiffObject[] {
  const unmatchedAfterById = _.keyBy(after, idToCompareWith);
  const diff = [];

  for (const beforeItem of before) {
    if (beforeItem == undefined || typeof beforeItem !== "object") {
      throw new Error("beforeItem is invalid; should have checked this earlier");
    }
    const id = (beforeItem as DiffObject)[idToCompareWith];
    const innerDiff = getDiff({
      before: beforeItem,
      after: unmatchedAfterById[id as string],
      idLabel: idToCompareWith,
      showFullMessageForDiff,
    });
    delete unmatchedAfterById[id as string];

    if (!_.isEmpty(innerDiff)) {
      diff.push(processDiffForBeforeItem(innerDiff as DiffObject, idToCompareWith, id));
    }
  }

  for (const afterItem of Object.values(unmatchedAfterById)) {
    const innerDiff = getDiff({
      before: undefined,
      after: afterItem,
      idLabel: idToCompareWith,
      showFullMessageForDiff,
    });
    if (!_.isEmpty(innerDiff)) {
      diff.push(innerDiff as DiffObject);
    }
  }

  return diff;
}

function diffArrays(
  before: unknown[],
  after: unknown[],
  { showFullMessageForDiff }: { showFullMessageForDiff: boolean },
): DiffObject | DiffObject[] | undefined {
  const idToCompareWith = findIdFieldForArrayComparison(before, after);
  if (idToCompareWith != undefined) {
    return diffArraysByIdField(before, after, idToCompareWith, { showFullMessageForDiff });
  }
  // Fall back to treating array as object (diff by index)
  return diffObjects(before as unknown as DiffObject, after as unknown as DiffObject, {
    showFullMessageForDiff,
  });
}

function diffObjects(
  before: DiffObject,
  after: DiffObject,
  { showFullMessageForDiff }: { showFullMessageForDiff: boolean },
): DiffObject {
  const diff: DiffObject = {};
  const allKeys = Object.keys(before).concat(Object.keys(after));

  for (const key of _.uniq(allKeys)) {
    const innerDiff = getDiff({
      before: before[key],
      after: after[key],
      idLabel: undefined,
      showFullMessageForDiff,
    });
    if (!_.isEmpty(innerDiff)) {
      diff[key] = innerDiff;
    } else if (showFullMessageForDiff) {
      diff[key] = before[key] ?? {};
    }
  }

  return diff;
}

function isNotObject(value: unknown): boolean {
  return Array.isArray(value) || typeof value !== "object";
}

function createIdLabelObj(value: DiffObject, idLabel: string): DiffObject {
  return {
    [diffLabels.ID.labelText]: { [idLabel]: value[idLabel] },
  };
}

function createLabeledDiff(labelText: string, value: unknown, idLabel?: string): DiffObject {
  if (!idLabel || isNotObject(value)) {
    return { [labelText]: value };
  }

  const valueObj = value as DiffObject;
  const idLabelObj = createIdLabelObj(valueObj, idLabel);
  return {
    [labelText]: { ...idLabelObj, ...valueObj },
  };
}

function createAddedDiff(after: unknown, idLabel?: string): DiffObject {
  return createLabeledDiff(diffLabels.ADDED.labelText, after, idLabel);
}

function createDeletedDiff(before: unknown, idLabel?: string): DiffObject {
  return createLabeledDiff(diffLabels.DELETED.labelText, before, idLabel);
}

function createChangedDiff(before: unknown, after: unknown): DiffObject {
  const beforeText = typeof before === "bigint" ? before.toString() : JSON.stringify(before);
  const afterText = typeof after === "bigint" ? after.toString() : JSON.stringify(after);
  return {
    [diffLabels.CHANGED.labelText]: `${beforeText} ${diffArrow} ${afterText}`,
  };
}

export default function getDiff({
  before,
  after,
  idLabel,
  showFullMessageForDiff = false,
}: {
  before: unknown;
  after: unknown;
  idLabel?: string;
  showFullMessageForDiff?: boolean;
}): undefined | DiffObject | DiffObject[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    return diffArrays(before, after, { showFullMessageForDiff });
  }

  if (typeof before === "object" && typeof after === "object" && before && after) {
    return diffObjects(before as DiffObject, after as DiffObject, { showFullMessageForDiff });
  }

  if (before === after) {
    return undefined;
  }

  if (before == undefined) {
    return createAddedDiff(after, idLabel);
  }

  if (after == undefined) {
    return createDeletedDiff(before, idLabel);
  }

  return createChangedDiff(before, after);
}
