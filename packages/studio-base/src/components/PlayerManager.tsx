// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToasts } from "react-toast-notifications";
import { useLocalStorage } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import { useCurrentLayoutSelector } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PlayerSelectionContext, {
  IDataSourceFactory,
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";
import useWarnImmediateReRender from "@foxglove/studio-base/hooks/useWarnImmediateReRender";
import AnalyticsMetricsCollector from "@foxglove/studio-base/players/AnalyticsMetricsCollector";
import OrderedStampPlayer from "@foxglove/studio-base/players/OrderedStampPlayer";
import UserNodePlayer from "@foxglove/studio-base/players/UserNodePlayer";
import { Player } from "@foxglove/studio-base/players/types";
import { UserNodes } from "@foxglove/studio-base/types/panels";
import Storage from "@foxglove/studio-base/util/Storage";

const log = Logger.getLogger(__filename);

const DEFAULT_MESSAGE_ORDER = "receiveTime";
const EMPTY_USER_NODES: UserNodes = Object.freeze({});
const EMPTY_GLOBAL_VARIABLES: GlobalVariables = Object.freeze({});

type PlayerManagerProps = {
  playerSources: IDataSourceFactory[];
};

export default function PlayerManager(props: PropsWithChildren<PlayerManagerProps>): JSX.Element {
  const { children, playerSources } = props;

  useWarnImmediateReRender();

  const { setUserNodeDiagnostics, addUserNodeLogs, setUserNodeRosLib } = useUserNodeState();
  const userNodeActions = useShallowMemo({
    setUserNodeDiagnostics,
    addUserNodeLogs,
    setUserNodeRosLib,
  });

  const prompt = usePrompt();

  // When we implement per-data-connector UI settings we will move this into the ROS 1 Socket data
  // connector. As a workaround, we read this from our app settings and provide this to
  // initialization args for all connectors.
  const [rosHostname] = useAppConfigurationValue<string>(AppSetting.ROS1_ROS_HOSTNAME);

  const analytics = useAnalytics();
  const metricsCollector = useMemo(() => new AnalyticsMetricsCollector(analytics), [analytics]);

  // When we implmenent per-data-connector UI settings we will move this into the appropriate
  // data sources. We might also consider this a studio responsibility and handle generically for
  // all data sources.
  const [unlimitedMemoryCache = false] = useAppConfigurationValue<boolean>(
    AppSetting.UNLIMITED_MEMORY_CACHE,
  );

  // When we implement per-data-connector UI settings we will move this into the foxglove data platform source.
  const consoleApi = useContext(ConsoleApiContext);

  const messageOrder = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.playbackConfig.messageOrder,
  );
  const userNodes = useCurrentLayoutSelector((state) => state.selectedLayout?.data?.userNodes);
  const globalVariables = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.globalVariables ?? EMPTY_GLOBAL_VARIABLES,
  );

  const globalVariablesRef = useRef<GlobalVariables>(globalVariables);
  const [basePlayer, setBasePlayer] = useState<Player | undefined>();

  // We don't want to recreate the player when the message order changes, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array below to defeat the linter.
  const [initialMessageOrder] = useState(messageOrder);

  const player = useMemo<OrderedStampPlayer | undefined>(() => {
    if (!basePlayer) {
      return undefined;
    }

    const userNodePlayer = new UserNodePlayer(basePlayer, userNodeActions);
    const headerStampPlayer = new OrderedStampPlayer(
      userNodePlayer,
      initialMessageOrder ?? DEFAULT_MESSAGE_ORDER,
    );
    headerStampPlayer.setGlobalVariables(globalVariablesRef.current);
    return headerStampPlayer;
  }, [basePlayer, initialMessageOrder, userNodeActions]);

  useEffect(() => {
    player?.setMessageOrder(messageOrder ?? DEFAULT_MESSAGE_ORDER);
  }, [player, messageOrder]);
  useEffect(() => {
    player?.setUserNodes(userNodes ?? EMPTY_USER_NODES);
  }, [player, userNodes]);

  const { addToast } = useToasts();
  const [savedSource, setSavedSource, removeSavedSource] = useLocalStorage<{
    id: string;
    args?: Record<string, unknown>;
  }>("studio.playermanager.selected-source.v2");

  const [selectedSource, setSelectedSource] = useState<IDataSourceFactory | undefined>();

  const selectSource = useCallback(
    async (sourceId: string, args?: Record<string, unknown>) => {
      log.debug(`Select Source: ${sourceId}`);

      if (!sourceId) {
        removeSavedSource();
        setSelectedSource(undefined);
        return;
      }

      removeSavedSource();

      const foundSource = playerSources.find((source) => source.id === sourceId);
      if (!foundSource) {
        addToast(`Unknown data source: ${sourceId}`, {
          appearance: "warning",
        });
        return;
      }

      setSelectedSource(() => foundSource);

      if (foundSource.promptOptions) {
        let argUrl: string | undefined;
        if (typeof args?.url === "string") {
          argUrl = args?.url;
        }

        // Load the previous prompt value
        const previousPromptCacheKey = `${foundSource.id}.previousPromptValue`;
        const previousPromptValue = new Storage().getItem<string>(previousPromptCacheKey);

        const promptOptions = foundSource.promptOptions(argUrl ?? previousPromptValue);
        try {
          // If the arg url is specified we don't need to prompt
          const url = argUrl ?? (await prompt(promptOptions));
          if (!url) {
            return;
          }

          new Storage().setItem(previousPromptCacheKey, url);

          // only url based sources are saved as the selected source
          setSavedSource({
            id: sourceId,
            args: {
              ...args,
              url,
              rosHostname,
              metricsCollector,
              unlimitedMemoryCache,
            },
          });

          const newPlayer = foundSource.initialize({ url, metricsCollector, unlimitedMemoryCache });
          setBasePlayer(newPlayer);
        } catch (error) {
          addToast(error.message, { appearance: "error" });
        }

        return;
      }

      if (foundSource.supportsOpenDirectory === true) {
        try {
          const folder = await showDirectoryPicker();
          const newPlayer = foundSource.initialize({
            folder,
            metricsCollector,
            unlimitedMemoryCache,
          });
          setBasePlayer(newPlayer);
        } catch (error) {
          if (error.name === "AbortError") {
            return undefined;
          }
          addToast(error.message, { appearance: "error" });
        }

        return;
      }

      const supportedFileTypes = foundSource.supportedFileTypes;
      if (supportedFileTypes != undefined) {
        try {
          let file = (args?.files as File[] | undefined)?.[0];

          if (!file) {
            const [fileHandle] = await showOpenFilePicker({
              types: [
                {
                  description: foundSource.displayName,
                  accept: { "application/octet-stream": supportedFileTypes },
                },
              ],
            });
            file = await fileHandle.getFile();
          }

          const newPlayer = foundSource.initialize({
            file,
            metricsCollector,
            unlimitedMemoryCache,
          });
          setBasePlayer(newPlayer);
        } catch (error) {
          if (error.name === "AbortError") {
            return;
          }
          addToast(error.message, { appearance: "error" });
        }

        return;
      }

      try {
        const newPlayer = foundSource.initialize({
          ...args,
          consoleApi,
          metricsCollector,
          unlimitedMemoryCache,
        });
        setBasePlayer(newPlayer);
      } catch (error) {
        addToast(error.message, { appearance: "error" });
      }

      return;
    },
    [
      addToast,
      consoleApi,
      metricsCollector,
      playerSources,
      prompt,
      removeSavedSource,
      rosHostname,
      setSavedSource,
      unlimitedMemoryCache,
    ],
  );

  // restore the saved source on first mount
  useLayoutEffect(() => {
    if (savedSource) {
      const foundSource = playerSources.find((source) => source.id === savedSource.id);
      if (!foundSource) {
        return;
      }

      const initializedBasePlayer = foundSource.initialize({
        ...savedSource.args,
        metricsCollector,
        unlimitedMemoryCache,
      });
      setBasePlayer(initializedBasePlayer);
    }
    // we only run the layout effect on first mount - never again even if the saved source changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PlayerSelection = {
    selectSource,
    selectedSource,
    availableSources: playerSources,
  };

  return (
    <>
      <PlayerSelectionContext.Provider value={value}>
        <MessagePipelineProvider player={player} globalVariables={globalVariables}>
          {children}
        </MessagePipelineProvider>
      </PlayerSelectionContext.Provider>
    </>
  );
}
