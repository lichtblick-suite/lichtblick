// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isString, pickBy } from "lodash";
import { useEffect } from "react";
import { useDebounce } from "use-debounce";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { EventsStore, useEvents } from "@foxglove/studio-base/context/EventsContext";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import { AppURLState, updateAppURLState } from "@foxglove/studio-base/util/appURLState";

const selectCanSeek = (ctx: MessagePipelineContext) =>
  ctx.playerState.capabilities.includes(PlayerCapabilities.playbackControl);
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectUrlState = (ctx: MessagePipelineContext) => ctx.playerState.urlState;
const selectLayoutId = (layoutState: LayoutState) => layoutState.selectedLayout?.id;
const selectSelectedEventId = (store: EventsStore) => store.selectedEventId;

function updateUrl(newState: AppURLState) {
  const newStateUrl = updateAppURLState(new URL(window.location.href), newState);
  window.history.replaceState(undefined, "", newStateUrl.href);
}

/**
 * Syncs our current player, layout and other state with the URL in the address bar.
 */
export function useStateToURLSynchronization(): void {
  const playerUrlState = useMessagePipeline(selectUrlState);
  const stablePlayerUrlState = useDeepMemo(playerUrlState);
  const canSeek = useMessagePipeline(selectCanSeek);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const layoutId = useCurrentLayoutSelector(selectLayoutId);
  const [debouncedCurrentTime] = useDebounce(currentTime, 500, { maxWait: 500 });
  const selectedEventId = useEvents(selectSelectedEventId);

  // Sync current time with the url.
  useEffect(() => {
    updateUrl({
      time: canSeek ? debouncedCurrentTime : undefined,
    });
  }, [canSeek, debouncedCurrentTime]);

  // Sync layoutId with the url.
  useEffect(() => {
    if (layoutId == undefined) {
      return;
    }

    updateUrl({ layoutId });
  }, [layoutId]);

  // Sync player state with the url.
  useEffect(() => {
    if (stablePlayerUrlState == undefined) {
      return;
    }

    updateUrl({
      ds: stablePlayerUrlState.sourceId,
      dsParams: pickBy(
        {
          ...stablePlayerUrlState.parameters,
          eventId: selectedEventId,
        },
        isString,
      ),
    });
  }, [selectedEventId, stablePlayerUrlState]);
}
