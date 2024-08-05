// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { useEffect } from "react";

const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

/**
 * DocumentTitleAdapter sets the document title based on the currently selected player
 */
export default function DocumentTitleAdapter(): JSX.Element {
  const playerName = useMessagePipeline(selectPlayerName);

  useEffect(() => {
    if (!playerName) {
      window.document.title = "Lichtblick";
      return;
    }
    window.document.title = navigator.userAgent.includes("Mac")
      ? playerName
      : `${playerName} – Lichtblick`;
  }, [playerName]);

  return <></>;
}
