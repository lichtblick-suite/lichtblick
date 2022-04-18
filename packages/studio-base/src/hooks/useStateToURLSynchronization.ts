// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import { PlayerCapabilities, PlayerPresence } from "@foxglove/studio-base/players/types";
import { AppURLState, encodeAppURLState } from "@foxglove/studio-base/util/appURLState";

const selectCanSeek = (ctx: MessagePipelineContext) =>
  ctx.playerState.capabilities.includes(PlayerCapabilities.playbackControl);
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectUrlState = (ctx: MessagePipelineContext) => ctx.playerState.urlState;
const selectLayoutId = (layoutState: LayoutState) => layoutState.selectedLayout?.id;
const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

// Write the unsaved app state to the url
function writeStateToUrl(state: AppURLState) {
  const url = encodeAppURLState(new URL(window.location.href), state);
  window.history.replaceState(undefined, "", url.href);
}

/**
 * Syncs our current player, layout and other state with the URL in the address bar.
 */
export function useStateToURLSynchronization(): void {
  const canSeek = useMessagePipeline(selectCanSeek);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const playerUrlState = useMessagePipeline(selectUrlState);
  const layoutId = useCurrentLayoutSelector(selectLayoutId);
  const stablePlayerUrlState = useDeepMemo(playerUrlState);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const { selectedSource } = usePlayerSelection();

  // This ref tracks the state of our player. Because the selected source and the active player
  // are in different contexts we have to do some extra work to act on the state of both of
  // them correctly.
  const playerIsStableRef = useRef(false);

  // Debounce url updates to prevent thrashing when currentTime updates tne unsaved state
  const queueUpdateUrl = useDebouncedCallback(writeStateToUrl, 500, {
    leading: true,
    maxWait: 500,
  });

  // Mark our player state as unstable when a new source is selected.
  useEffect(() => {
    playerIsStableRef.current = false;
  }, [selectedSource]);

  // Wait until the player is present to switch player state back to stable.
  useEffect(() => {
    if (playerPresence === PlayerPresence.PRESENT) {
      playerIsStableRef.current = true;
    }
  }, [playerPresence]);

  useEffect(() => {
    // Don't update url unless we have a stable player state and a selected source.
    if (!playerIsStableRef.current || !selectedSource) {
      return;
    }

    queueUpdateUrl({
      layoutId,
      ds: selectedSource.id,
      dsParams: stablePlayerUrlState,
      time: canSeek ? currentTime : undefined,
    });
  }, [
    canSeek,
    currentTime,
    layoutId,
    playerPresence,
    queueUpdateUrl,
    selectedSource,
    stablePlayerUrlState,
  ]);
}
