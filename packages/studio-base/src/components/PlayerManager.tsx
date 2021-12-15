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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToasts } from "react-toast-notifications";
import { useAsync, useLocalStorage, useMountedState } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import PlayerSelectionContext, {
  DataSourceArgs,
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
import {
  IndexedDbRecentsStore,
  RecentRecord,
} from "@foxglove/studio-base/util/IndexedDbRecentsStore";
import Storage from "@foxglove/studio-base/util/Storage";
import { windowHasValidURLState } from "@foxglove/studio-base/util/appURLState";

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

  const recentsStore = useMemo(() => new IndexedDbRecentsStore(), []);

  const { setUserNodeDiagnostics, addUserNodeLogs, setUserNodeRosLib } = useUserNodeState();
  const userNodeActions = useShallowMemo({
    setUserNodeDiagnostics,
    addUserNodeLogs,
    setUserNodeRosLib,
  });

  const prompt = usePrompt();

  const isMounted = useMountedState();

  // When we implement per-data-connector UI settings we will move this into the ROS 1 Socket data
  // connector. As a workaround, we read this from our app settings and provide this to
  // initialization args for all connectors.
  const [rosHostname] = useAppConfigurationValue<string>(AppSetting.ROS1_ROS_HOSTNAME);

  const [enableOpenDialog] = useAppConfigurationValue(AppSetting.OPEN_DIALOG);

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

  const layoutStorage = useLayoutManager();
  const { setSelectedLayoutId } = useCurrentLayoutActions();

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

  useLayoutEffect(() => {
    player?.setMessageOrder(messageOrder ?? DEFAULT_MESSAGE_ORDER);
  }, [player, messageOrder]);
  useLayoutEffect(() => {
    void player?.setUserNodes(userNodes ?? EMPTY_USER_NODES);
  }, [player, userNodes]);

  const { addToast } = useToasts();
  const [savedSource, setSavedSource, removeSavedSource] = useLocalStorage<{
    id: string;
    args?: Record<string, unknown>;
  }>("studio.playermanager.selected-source.v2");

  const [selectedSource, setSelectedSource] = useState<IDataSourceFactory | undefined>();

  const { value: initialRecents } = useAsync(async () => await recentsStore.get(), [recentsStore]);
  const [recents, setRecents] = useState<RecentRecord[]>([]);

  // Set the first load records from the store to the state
  useLayoutEffect(() => {
    if (!initialRecents) {
      return;
    }
    setRecents(initialRecents);
  }, [initialRecents]);

  const saveRecents = useCallback(
    (recentRecords: RecentRecord[]) => {
      recentsStore.set(recentRecords).catch((err) => {
        log.error(err);
      });
    },
    [recentsStore],
  );

  // Add a new recent entry
  const addRecent = useCallback(
    (record: RecentRecord) => {
      setRecents((prevRecents) => {
        // To keep only the latest 5 recent items, we remove any items index 4+
        prevRecents.splice(4, 100);
        prevRecents.unshift(record);

        saveRecents(prevRecents);
        return [...prevRecents];
      });
    },
    [saveRecents],
  );

  // Make a RecentSources array for the PlayerSelectionContext
  const recentSources = useMemo(() => {
    return recents.map((item) => {
      return { id: item.id, title: item.title, label: item.label };
    });
  }, [recents]);

  const selectSource = useCallback(
    async (sourceId: string, args?: DataSourceArgs) => {
      log.debug(`Select Source: ${sourceId}`);

      // empty string sourceId
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

      metricsCollector.setProperty("player", sourceId);
      setSelectedSource(() => foundSource);

      // Sample sources don't need args or prompts to initialize
      if (foundSource.type === "sample") {
        const newPlayer = foundSource.initialize({
          consoleApi,
          metricsCollector,
          unlimitedMemoryCache,
        });

        setBasePlayer(newPlayer);

        if (foundSource.sampleLayout) {
          layoutStorage
            .saveNewLayout({
              name: foundSource.displayName,
              data: foundSource.sampleLayout,
              permission: "CREATOR_WRITE",
            })
            .then((newLayout) => {
              if (!isMounted()) {
                return;
              }
              setSelectedLayoutId(newLayout.id);
            })
            .catch((err) => {
              addToast((err as Error).message, { appearance: "error" });
            });
        }

        return;
      }

      // If args is provided we try to initialize with no prompts
      if (args) {
        try {
          switch (args.type) {
            case "connection": {
              const newPlayer = foundSource.initialize({
                ...args.params,
                consoleApi,
                metricsCollector,
                unlimitedMemoryCache,
              });
              setBasePlayer(newPlayer);

              if (args.params?.url && args.skipRecents !== true) {
                addRecent({
                  id: IndexedDbRecentsStore.GenerateRecordId(),
                  type: "connection",
                  sourceId: foundSource.id,
                  title: args.params?.url,
                  label: foundSource.displayName,
                  extra: args.params,
                });
              }

              break;
            }
            case "file": {
              const files = args.files;

              // files we can try loading immediately
              // We do not add these to recents entries because putting File in indexedb reuslts in
              // the entire file being stored in the database.
              if (files) {
                let file = files[0];
                const fileList: File[] = [];

                for (const curFile of files) {
                  file ??= curFile;
                  fileList.push(curFile);
                }
                const multiFile = foundSource.supportsMultiFile === true && fileList.length > 1;

                const newPlayer = foundSource.initialize({
                  file: multiFile ? undefined : file,
                  files: multiFile ? fileList : undefined,
                  metricsCollector,
                  unlimitedMemoryCache,
                });

                setBasePlayer(newPlayer);
                return;
              }

              break;
            }
          }
        } catch (error) {
          addToast((error as Error).message, { appearance: "error" });
        }

        return;
      }

      if (foundSource.promptOptions) {
        let argUrl: string | undefined;

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

          const allArgs = {
            rosHostname,
            url,
          };

          // only url based sources are saved as the selected source
          setSavedSource({
            id: sourceId,
            args: allArgs,
          });

          new Storage().setItem(previousPromptCacheKey, url);
          const newPlayer = foundSource.initialize({ url, metricsCollector, unlimitedMemoryCache });
          setBasePlayer(newPlayer);

          addRecent({
            id: IndexedDbRecentsStore.GenerateRecordId(),
            type: "connection",
            sourceId,
            title: url,
            label: foundSource.displayName,
            extra: allArgs,
          });
        } catch (error) {
          addToast((error as Error).message, { appearance: "error" });
        }

        return;
      }

      const supportedFileTypes = foundSource.supportedFileTypes;
      if (supportedFileTypes != undefined) {
        try {
          const fileList: File[] = [];
          let file: File | undefined;
          let handles: FileSystemFileHandle[] | undefined;

          if (!file) {
            handles = await showOpenFilePicker({
              multiple: foundSource.supportsMultiFile,
              types: [
                {
                  description: foundSource.displayName,
                  accept: { "application/octet-stream": supportedFileTypes },
                },
              ],
            });
            for (const fileHandle of handles) {
              const curFile = await fileHandle.getFile();
              file ??= curFile;
              fileList.push(curFile);
            }
          }

          const multiFile = foundSource.supportsMultiFile === true && fileList.length > 1;

          const newPlayer = foundSource.initialize({
            file: multiFile ? undefined : file,
            files: multiFile ? fileList : undefined,
            metricsCollector,
            unlimitedMemoryCache,
          });

          setBasePlayer(newPlayer);
        } catch (error) {
          if (error.name === "AbortError") {
            return;
          }
          addToast((error as Error).message, { appearance: "error" });
        }

        return;
      }

      addToast("Unable to initialize player", { appearance: "error" });
    },
    [
      addRecent,
      addToast,
      consoleApi,
      isMounted,
      layoutStorage,
      metricsCollector,
      playerSources,
      prompt,
      removeSavedSource,
      rosHostname,
      setSavedSource,
      setSelectedLayoutId,
      unlimitedMemoryCache,
    ],
  );

  // Select a recent entry by id
  const selectRecent = useCallback(
    (recentId: string) => {
      // find the recent from the list and initialize
      const foundRecent = recents.find((value) => value.id === recentId);
      if (!foundRecent) {
        addToast(`Failed to restore recent: ${recentId}`, {
          appearance: "error",
        });
        return;
      }

      switch (foundRecent.type) {
        case "connection": {
          void selectSource(foundRecent.sourceId, {
            skipRecents: true,
            type: "connection",
            params: foundRecent.extra,
          });
          break;
        }
      }
    },
    [recents, addToast, selectSource],
  );

  // Restore the saved source on first mount unless our url specifies a source.
  useLayoutEffect(() => {
    // with open dialog enabled we don't restore any data source
    if (enableOpenDialog === true) {
      return;
    }

    // The URL encodes a valid session state. Defer to the URL state.
    if (windowHasValidURLState()) {
      return;
    }

    if (savedSource) {
      const foundSource = playerSources.find((source) => source.id === savedSource.id);
      if (!foundSource) {
        return;
      }
      metricsCollector.setProperty("player", savedSource.id);

      const initializedBasePlayer = foundSource.initialize({
        ...savedSource.args,
        metricsCollector,
        unlimitedMemoryCache,
      });
      setBasePlayer(initializedBasePlayer);
      setSelectedSource(() => foundSource);
    }
    // we only run the layout effect on first mount - never again even if the saved source changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PlayerSelection = {
    selectSource,
    selectRecent,
    selectedSource,
    availableSources: playerSources,
    recentSources,
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
