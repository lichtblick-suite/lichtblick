// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseMessagePath, MessagePathPart } from "@lichtblick/message-path";

import { SubscriptionPreloadType, SubscribePayload } from "./types";

/**
 * Builds a SubscribePayload from a message path, requesting a specific field of the message if the
 * message path resolves to a field name.
 */
export function subscribePayloadFromMessagePath(
  path: string,
  preloadType?: SubscriptionPreloadType,
): undefined | SubscribePayload {
  const parsedPath = parseMessagePath(path);

  if (!parsedPath) {
    return undefined;
  }

  type NamePart = MessagePathPart & { type: "name" };

  const firstField = parsedPath.messagePath.find(
    (element): element is NamePart => element.type === "name",
  );

  if (!firstField) {
    return { topic: parsedPath.topicName, preloadType: preloadType ?? "partial" };
  }

  return {
    topic: parsedPath.topicName,
    preloadType: preloadType ?? "partial",
    fields: [firstField.name],
  };
}
