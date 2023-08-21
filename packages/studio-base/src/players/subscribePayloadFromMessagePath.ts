// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathPart } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";

import { SubscriptionPreloadType, SubscribePayload } from "./types";

/**
 * Builds a SubscribePayload from a message path, requesting a specific field of the message if the
 * message path resolves to a field name.
 */
export function subscribePayloadFromMessagePath(
  path: string,
  preloadType?: SubscriptionPreloadType,
): undefined | SubscribePayload {
  const parsedPath = parseRosPath(path);

  if (!parsedPath) {
    return undefined;
  }

  type NamePart = MessagePathPart & { type: "name" };

  const firstField = parsedPath.messagePath.find(
    (element): element is NamePart => element.type === "name",
  );

  if (!firstField) {
    return { topic: parsedPath.topicName, preloadType };
  }

  return {
    topic: parsedPath.topicName,
    preloadType,
    fields: [firstField.name],
  };
}
