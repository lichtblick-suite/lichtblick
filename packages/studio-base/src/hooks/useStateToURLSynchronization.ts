// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useRef } from "react";
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
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import {
  AppURLState,
  encodeAppURLState,
  parseAppURLState,
} from "@foxglove/studio-base/util/appURLState";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const selectCanSeek = (ctx: MessagePipelineContext) =>
  ctx.playerState.capabilities.includes(PlayerCapabilities.playbackControl);
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectUrlState = (ctx: MessagePipelineContext) => ctx.playerState.urlState;
const selectLayoutId = (layoutState: LayoutState) => layoutState.selectedLayout?.id;

/**
 * Syncs our current player, layout and other state with the URL in the address bar.
 */
export function useStateToURLSynchronization(): void {
  const canSeek = useMessagePipeline(selectCanSeek);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const urlState = useMessagePipeline(selectUrlState);
  const layoutId = useCurrentLayoutSelector(selectLayoutId);
  const stableUrlState = useDeepMemo(urlState);
  const { selectedSource } = usePlayerSelection();

  // unsavedAppStateRef contains the app state that will be saved to the url
  // It starts out as the current url state values
  const unusavedAppStateRef = useRef<AppURLState>();
  function getUnsavedAppState(): AppURLState {
    return (unusavedAppStateRef.current ??= parseAppURLState(new URL(window.location.href)) ?? {});
  }

  // Write the unsaved app state to the url
  const updateUrl = useCallback(() => {
    const unsavedAppState = getUnsavedAppState();

    const url = encodeAppURLState(new URL(window.location.href), {
      ds: unsavedAppState.ds,
      layoutId: unsavedAppState.layoutId,
      time: unsavedAppState.time,
      dsParams: unsavedAppState.dsParams,
    });

    window.history.replaceState(undefined, "", url.href);
  }, []);

  // Debounce url updates to prevent thrashing when currentTime updates tne unsaved state
  const queueUpdateUrl = useDebouncedCallback(updateUrl, 500, {
    leading: true,
    maxWait: 500,
  });

  // During startup, many of the values (selectedSource, layoutId, etc) start out undefined.
  // We don't want their initial undefined state to clear the url state only to add it back
  // immediately. Conversely, if a value goes from being defined to undefined, we want to clear
  // the url state value.
  //
  // referenceAppStateRef lets us accomplish this. We start with an empty state and as the values
  // differ from our reference values, we update the unsavedAppState
  const referenceAppStateRef = useRef<AppURLState>({});

  useEffect(() => {
    // Electron has its own concept of what the app URL is. If we want to do anything
    // here for desktop we'll need to find some other method of encoding the state
    // like perhaps the URL hash.
    if (isDesktopApp()) {
      return;
    }

    const unsavedAppState = getUnsavedAppState();

    if (referenceAppStateRef.current.layoutId !== layoutId) {
      unsavedAppState.layoutId = layoutId;
    }

    if (referenceAppStateRef.current.ds !== selectedSource?.id) {
      unsavedAppState.ds = selectedSource?.id;
    }

    if (referenceAppStateRef.current.dsParams !== stableUrlState) {
      unsavedAppState.dsParams = stableUrlState;
    }

    const time = canSeek ? currentTime : undefined;
    if (referenceAppStateRef.current.time !== time) {
      unsavedAppState.time = time;
    }

    referenceAppStateRef.current = {
      layoutId,
      ds: selectedSource?.id,
      dsParams: stableUrlState,
      time,
    };

    queueUpdateUrl();
  }, [canSeek, currentTime, layoutId, queueUpdateUrl, selectedSource, stableUrlState]);
}
