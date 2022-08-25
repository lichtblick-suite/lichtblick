// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";

const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

/**
 * DocumentTitleAdapter sets the document title based on the currently selected player
 */
export default function DocumentTitleAdapter(): JSX.Element {
  const playerName = useMessagePipeline(selectPlayerName);

  useEffect(() => {
    if (!playerName) {
      window.document.title = "Foxglove Studio";
      return;
    }
    window.document.title = navigator.userAgent.includes("Mac")
      ? playerName
      : `${playerName} – Foxglove Studio`;
  }, [playerName]);

  return <></>;
}
