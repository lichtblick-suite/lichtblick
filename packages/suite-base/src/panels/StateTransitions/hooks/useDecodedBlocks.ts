// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo } from "react";

import { filterMap } from "@lichtblick/den/collection";
import { useBlocksSubscriptions } from "@lichtblick/suite-base/PanelAPI";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { subscribePayloadFromMessagePath } from "@lichtblick/suite-base/players/subscribePayloadFromMessagePath";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";

import { StateTransitionConfig } from "../types";

export function useDecodedBlocks(paths: StateTransitionConfig["paths"]): MessageDataItemsByPath[] {
  const pathStrings = useMemo(() => paths.map(({ value }) => value), [paths]);
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);

  const subscriptions: SubscribePayload[] = useMemo(
    () =>
      filterMap(paths, (path) => {
        const payload = subscribePayloadFromMessagePath(path.value, "full");
        // Include the header in case we are ordering by header stamp.
        if (path.timestampMethod === "headerStamp" && payload?.fields != undefined) {
          payload.fields.push("header");
        }
        return payload;
      }),
    [paths],
  );

  const blocks = useBlocksSubscriptions(subscriptions);

  const decodedBlocks = useMemo(
    () => blocks.map(decodeMessagePathsForMessagesByTopic),
    [blocks, decodeMessagePathsForMessagesByTopic],
  );

  return decodedBlocks;
}
