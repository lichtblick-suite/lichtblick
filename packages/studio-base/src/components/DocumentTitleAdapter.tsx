// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useNativeWindow } from "@foxglove/studio-base/context/NativeWindowContext";

const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;
const selectPlayerFilePath = (ctx: MessagePipelineContext) => ctx.playerState.filePath;

/**
 * DocumentTitleAdapter sets the document title based on the currently selected player
 */
export default function DocumentTitleAdapter(): JSX.Element {
  const nativeWindow = useNativeWindow();
  const playerName = useMessagePipeline(selectPlayerName);
  const filePath = useMessagePipeline(selectPlayerFilePath);

  useEffect(() => {
    if (!playerName) {
      window.document.title = "Foxglove Studio";
      return;
    }
    window.document.title = navigator.userAgent.includes("Mac")
      ? playerName
      : `${playerName} – Foxglove Studio`;
  }, [playerName]);

  useEffect(() => {
    nativeWindow?.setRepresentedFilename(filePath);
  }, [filePath, nativeWindow]);

  return <></>;
}
