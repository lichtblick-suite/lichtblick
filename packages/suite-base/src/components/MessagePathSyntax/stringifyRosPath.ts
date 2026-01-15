// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathFilter, MessagePathPart, MessagePath } from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";

type SlicePart = number | { variableName: string; startLoc: number };

type Slice = {
  start: SlicePart;
  end: SlicePart;
};

/**
 * Return the string representation of the ros path
 */
export function stringifyMessagePath(path: Immutable<MessagePath>): string {
  return (
    path.topicNameRepr +
    path.messagePath.map(stringifyMessagePathPart).join("") +
    (path.modifier ? `.@${path.modifier}` : "")
  );
}

function stringifyMessagePathPart(part: Immutable<MessagePathPart>): string {
  switch (part.type) {
    case "name":
      return `.${part.repr}`;
    case "filter":
      return filterToString(part);
    case "slice":
      return sliceToString(part);
  }
  return "";
}

function sliceToString(slice: Immutable<Slice>): string {
  if (typeof slice.start === "number" && typeof slice.end === "number") {
    if (slice.start === slice.end) {
      return `[${slice.start}]`;
    }
    if (slice.start === 0) {
      return `[:${slice.end === Infinity ? "" : slice.end}]`;
    }
    return `[${slice.start === Infinity ? "" : slice.start}:${
      slice.end === Infinity ? "" : slice.end
    }]`;
  }

  const startStr = slicePartToString(slice.start);
  const endStr = slicePartToString(slice.end);
  if (startStr === endStr) {
    return `[${startStr}]`;
  }

  return `[${startStr}:${endStr}]`;
}

function slicePartToString(slicePart: Immutable<SlicePart>): string {
  if (typeof slicePart === "number") {
    if (slicePart === Infinity) {
      return "";
    }
    return String(slicePart);
  }

  return `$${slicePart.variableName}`;
}

function filterToString(filter: Immutable<MessagePathFilter>): string {
  if (typeof filter.value === "object") {
    return `{${filter.repr}}`;
  }

  return `{${filter.path.join(".")}==${
    typeof filter.value === "bigint" ? filter.value.toString() : JSON.stringify(filter.value)
  }}`;
}
