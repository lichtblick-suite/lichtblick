// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useRef } from "react";

import Log from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import { useSessionStorageValue } from "@foxglove/studio-base/hooks/useSessionStorageValue";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { AppURLState, parseAppURLState } from "@foxglove/studio-base/util/appURLState";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectUrlState = (ctx: MessagePipelineContext) => ctx.playerState.urlState;

const log = Log.getLogger(__filename);

/**
 * Restores our session state from any deep link we were passed on startup.
 */
export function useInitialDeepLinkState(deepLinks: string[]): void {
  const stableUrlState = useDeepMemo(useMessagePipeline(selectUrlState));
  const { selectSource } = usePlayerSelection();
  const { setSelectedLayoutId } = useCurrentLayoutActions();
  const [launchPreference, setLaunchPreference] = useSessionStorageValue(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const seekPlayback = useMessagePipeline(selectSeek);
  const playerPresence = useMessagePipeline(selectPlayerPresence);

  const appUrlRef = useRef<AppURLState | undefined>();
  if (!appUrlRef.current) {
    const firstLink = deepLinks[0];
    if (firstLink) {
      try {
        appUrlRef.current = parseAppURLState(new URL(firstLink));
      } catch (error) {
        log.error(error);
      }
    }
  }

  const shouldSeekTimeRef = useRef(false);

  // Set a sessionStorage preference for web if we have a stable URL state.
  // This allows us to avoid asking for the preference immediately on
  // launch of an empty session and makes refreshes do the right thing.
  useEffect(() => {
    if (isDesktopApp()) {
      return;
    }

    if (stableUrlState && !launchPreference) {
      setLaunchPreference("web");
    }
  }, [launchPreference, setLaunchPreference, stableUrlState]);

  useEffect(() => {
    const urlState = appUrlRef.current;
    if (!urlState) {
      return;
    }

    // Apply any available datasource args
    if (urlState.ds) {
      log.debug("Initialising source from url", urlState);
      selectSource(urlState.ds, { type: "connection", params: urlState.dsParams });
      urlState.ds = undefined;
      urlState.dsParams = undefined;
      shouldSeekTimeRef.current = true;
    }

    // Apply any available layout id
    if (urlState.layoutId != undefined) {
      log.debug(`Initializing layout from url: ${urlState.layoutId}`);
      setSelectedLayoutId(urlState.layoutId);
      urlState.layoutId = undefined;
    }
  }, [selectSource, setSelectedLayoutId]);

  useEffect(() => {
    // Wait until player is ready before we try to seek.
    if (playerPresence !== PlayerPresence.PRESENT) {
      return;
    }

    const urlState = appUrlRef.current;
    if (urlState?.time == undefined || !seekPlayback) {
      return;
    }

    if (!shouldSeekTimeRef.current) {
      log.debug("Clearing urlState time");
      urlState.time = undefined;
      return;
    }

    shouldSeekTimeRef.current = false;

    log.debug(`Seeking to url time:`, urlState.time);
    seekPlayback(urlState.time);
    urlState.time = undefined;
  }, [playerPresence, seekPlayback]);
}
