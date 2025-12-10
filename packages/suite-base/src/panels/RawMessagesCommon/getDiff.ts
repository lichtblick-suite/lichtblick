// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import { DiffObject } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

export const diffLabels = {
  ADDED: {
    labelText: "STUDIO_DIFF___ADDED",
    color: "#404047",
    backgroundColor: "#daffe7",
    invertedBackgroundColor: "#182924",
    indicator: "+",
  },
  DELETED: {
    labelText: "STUDIO_DIFF___DELETED",
    color: "#404047",
    backgroundColor: "#ffdee3",
    invertedBackgroundColor: "#3d2327",
    indicator: "-",
  },
  CHANGED: {
    labelText: "STUDIO_DIFF___CHANGED",
    color: "#eba800",
  },
  ID: { labelText: "STUDIO_DIFF___ID" },
} as const;

export const diffLabelsByLabelText = _.keyBy(Object.values(diffLabels), "labelText");

function findIdFieldForArrayComparison(before: unknown[], after: unknown[]): string | undefined {
  const allItems = before.concat(after);
  if (typeof allItems[0] !== "object" || allItems[0] == undefined) {
    return undefined;
  }

  const candidateIdsToCompareWith: Record<string, { before: unknown[]; after: unknown[] }> = {};
  if ((allItems[0] as DiffObject).id != undefined) {
    candidateIdsToCompareWith.id = { before: [], after: [] };
  }
  for (const key in allItems[0]) {
    if (isTypicalFilterName(key)) {
      candidateIdsToCompareWith[key] = { before: [], after: [] };
    }
  }

  if (!_.every(allItems, (item) => typeof item === "object" && item)) {
    return undefined;
  }

  for (const [idKey, candidates] of Object.entries(candidateIdsToCompareWith)) {
    for (const beforeItem of before) {
      if ((beforeItem as DiffObject)[idKey] != undefined) {
        candidates.before.push((beforeItem as DiffObject)[idKey]);
      }
    }
  }

  for (const [idKey, candidates] of Object.entries(candidateIdsToCompareWith)) {
    for (const afterItem of after) {
      if ((afterItem as DiffObject)[idKey] != undefined) {
        candidates.after.push((afterItem as DiffObject)[idKey]);
      }
    }
  }

  for (const [idKey, { before: candidateIdBefore, after: candidateIdAfter }] of Object.entries(
    candidateIdsToCompareWith,
  )) {
    if (
      _.uniq(candidateIdBefore).length === before.length &&
      _.uniq(candidateIdAfter).length === after.length
    ) {
      return idKey;
    }
  }

  return undefined;
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
      const isDeleted =
        Object.keys(innerDiff as DiffObject).length === 1 &&
        Object.keys(innerDiff as DiffObject)[0] === diffLabels.DELETED.labelText;
      diff.push(
        isDeleted
          ? (innerDiff as DiffObject)
          : {
              [diffLabels.ID.labelText]: { [idToCompareWith]: id },
              ...(innerDiff as DiffObject),
            },
      );
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

function createAddedDiff(after: unknown, idLabel?: string): DiffObject {
  const afterIsNotObj = Array.isArray(after) || typeof after !== "object";
  if (!idLabel || afterIsNotObj) {
    return { [diffLabels.ADDED.labelText]: after };
  }
  const idLabelObj = {
    [diffLabels.ID.labelText]: { [idLabel]: { ...(after as DiffObject) }[idLabel] },
  };
  return {
    [diffLabels.ADDED.labelText]: { ...idLabelObj, ...(after as DiffObject) },
  };
}

function createDeletedDiff(before: unknown, idLabel?: string): DiffObject {
  const beforeIsNotObj = Array.isArray(before) || typeof before !== "object";
  if (!idLabel || beforeIsNotObj) {
    return { [diffLabels.DELETED.labelText]: before };
  }
  const idLabelObj = {
    [diffLabels.ID.labelText]: { [idLabel]: { ...(before as DiffObject) }[idLabel] },
  };
  return {
    [diffLabels.DELETED.labelText]: { ...idLabelObj, ...(before as DiffObject) },
  };
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
