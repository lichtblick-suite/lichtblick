// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { MessagePath } from "@lichtblick/message-path";
import type { Immutable } from "@lichtblick/suite";
import type {
  SubscribePayload,
  SubscriptionPreloadType,
} from "@lichtblick/suite-base/players/types";

export function pathToSubscribePayload(
  path: Immutable<MessagePath>,
  preloadType: SubscriptionPreloadType,
): SubscribePayload | undefined {
  const { messagePath: parts, topicName: topic } = path;

  const firstField = parts.find(
    (part): part is { type: "name"; name: string; repr: string } => part.type === "name",
  );

  if (firstField == undefined || firstField.name.length === 0) {
    return undefined;
  }

  const fields = new Set(["header", firstField.name]);

  for (const part of parts) {
    if (part.type !== "filter") {
      break;
    }

    const { path: filterPath } = part;
    const field = filterPath[0];
    if (field == undefined) {
      continue;
    }

    fields.add(field);
  }

  return {
    topic,
    preloadType,
    fields: Array.from(fields),
  };
}
