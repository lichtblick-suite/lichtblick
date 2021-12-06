// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo } from "react";

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
import { parseAppURLState } from "@foxglove/studio-base/util/appURLState";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectUrlState = (ctx: MessagePipelineContext) => ctx.playerState.urlState;

const log = Log.getLogger(__filename);

/**
 * Restores our session state from any deep link we were passed on startup.
 */
export function useInitialDeepLinkState(deepLinks: string[]): void {
  const urlState = useMessagePipeline(selectUrlState);
  const stableUrlState = useDeepMemo(urlState);
  const { selectSource } = usePlayerSelection();
  const { setSelectedLayoutId } = useCurrentLayoutActions();
  const [launchPreference, setLaunchPreference] = useSessionStorageValue(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const seekPlayback = useMessagePipeline(selectSeek);
  const appUrlState = useMemo(() => {
    const firstLink = deepLinks[0];
    if (firstLink) {
      try {
        return parseAppURLState(new URL(firstLink));
      } catch (error) {
        log.error(error);
        return undefined;
      }
    } else {
      return undefined;
    }
  }, [deepLinks]);

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

  // Load app state from deeplink url if present.
  useEffect(() => {
    if (appUrlState == undefined) {
      return;
    }

    try {
      selectSource(appUrlState.ds, appUrlState.dsParams);
    } catch (err) {
      log.error(err);
    }
  }, [appUrlState, selectSource]);

  // Select layout from deeplink URL if present.
  useEffect(() => {
    if (appUrlState == undefined) {
      return;
    }

    if (appUrlState.layoutId != undefined) {
      setSelectedLayoutId(appUrlState.layoutId);
    }
  }, [appUrlState, setSelectedLayoutId]);

  // Sync to url time once our source has loaded and playback control is available.
  // seekPlayback will be undefined until the new source has loaded.
  useEffect(() => {
    if (appUrlState?.time == undefined || !seekPlayback) {
      return;
    }

    seekPlayback(appUrlState.time);
  }, [appUrlState, seekPlayback]);
}
