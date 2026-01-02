// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { useSnackbar } from "notistack";
import {
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useLatest, useMountedState } from "react-use";

import { useWarnImmediateReRender } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import { Immutable } from "@lichtblick/suite";
import { MessagePipelineProvider } from "@lichtblick/suite-base/components/MessagePipeline";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { ExtensionCatalogContext } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { usePerformance } from "@lichtblick/suite-base/context/PerformanceContext";
import PlayerSelectionContext, {
  DataSourceArgs,
  IDataSourceFactory,
  PlayerSelection,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  UserScriptStore,
  useUserScriptState,
} from "@lichtblick/suite-base/context/UserScriptStateContext";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import useIndexedDbRecents, {
  RecentRecord,
} from "@lichtblick/suite-base/hooks/useIndexedDbRecents";
import AnalyticsMetricsCollector from "@lichtblick/suite-base/players/AnalyticsMetricsCollector";
import {
  TopicAliasFunctions,
  TopicAliasingPlayer,
} from "@lichtblick/suite-base/players/TopicAliasingPlayer/TopicAliasingPlayer";
import UserScriptPlayer from "@lichtblick/suite-base/players/UserScriptPlayer";
import { Player } from "@lichtblick/suite-base/players/types";
import { UserScripts } from "@lichtblick/suite-base/types/panels";
import { mergeMultipleFileNames } from "@lichtblick/suite-base/util/mergeMultipleFileName";

const log = Logger.getLogger(__filename);

type PlayerManagerProps = {
  playerSources: readonly IDataSourceFactory[];
};

const EMPTY_USER_NODES: UserScripts = Object.freeze({});
const EMPTY_GLOBAL_VARIABLES: GlobalVariables = Object.freeze({});

const userScriptsSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.userNodes ?? EMPTY_USER_NODES;
const globalVariablesSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.globalVariables ?? EMPTY_GLOBAL_VARIABLES;

const selectUserScriptActions = (store: UserScriptStore) => store.actions;

export default function PlayerManager(
  props: PropsWithChildren<PlayerManagerProps>,
): React.JSX.Element {
  const { children, playerSources } = props;

  const perfRegistry = usePerformance();

  useWarnImmediateReRender();

  const userScriptActions = useUserScriptState(selectUserScriptActions);

  const isMounted = useMountedState();

  const analytics = useAnalytics();
  const metricsCollector = useMemo(() => new AnalyticsMetricsCollector(analytics), [analytics]);

  const [basePlayer, setBasePlayer] = useState<Player | undefined>();

  const { recents, addRecent } = useIndexedDbRecents();

  const userScripts = useCurrentLayoutSelector(userScriptsSelector);
  const globalVariables = useCurrentLayoutSelector(globalVariablesSelector);

  const topicAliasPlayer = useMemo(() => {
    if (!basePlayer) {
      return undefined;
    }

    return new TopicAliasingPlayer(basePlayer);
  }, [basePlayer]);

  // Update the alias functions when they change. We do not need to re-render the player manager
  // since nothing in the local state has changed.
  const extensionCatalogContext = useContext(ExtensionCatalogContext);
  useEffect(() => {
    // Stable empty alias functions if we don't have any
    const emptyAliasFunctions: Immutable<TopicAliasFunctions> = [];

    // We only want to set alias functions on the player when the functions have changed
    let topicAliasFunctions =
      extensionCatalogContext?.getState().installedTopicAliasFunctions ?? emptyAliasFunctions;
    topicAliasPlayer?.setAliasFunctions(topicAliasFunctions);

    return extensionCatalogContext?.subscribe((state) => {
      if (topicAliasFunctions !== state.installedTopicAliasFunctions) {
        topicAliasFunctions = state.installedTopicAliasFunctions ?? emptyAliasFunctions;
        topicAliasPlayer?.setAliasFunctions(topicAliasFunctions);
      }
    });
  }, [extensionCatalogContext, topicAliasPlayer]);

  const globalVariablesRef = useLatest(globalVariables);

  const player = useMemo(() => {
    if (!topicAliasPlayer) {
      return undefined;
    }

    const userScriptPlayer = new UserScriptPlayer(
      topicAliasPlayer,
      userScriptActions,
      perfRegistry,
    );
    userScriptPlayer.setGlobalVariables(globalVariablesRef.current);

    return userScriptPlayer;
  }, [globalVariablesRef, topicAliasPlayer, userScriptActions, perfRegistry]);

  useLayoutEffect(() => void player?.setUserScripts(userScripts), [player, userScripts]);

  const { enqueueSnackbar } = useSnackbar();

  const [selectedSource, setSelectedSource] = useState<IDataSourceFactory | undefined>();

  const selectSource = useCallback(
    async (sourceId: string, args?: DataSourceArgs) => {
      log.debug(`Select Source: ${sourceId}`);

      const foundSource = playerSources.find(
        (source) => (source.id === sourceId || source.legacyIds?.includes(sourceId)) ?? false,
      );
      if (!foundSource) {
        enqueueSnackbar(`Unknown data source: ${sourceId}`, { variant: "warning" });
        return;
      }

      metricsCollector.setProperty("player", sourceId);

      setSelectedSource(foundSource);

      // Sample sources don't need args or prompts to initialize
      if (foundSource.type === "sample") {
        const newPlayer = foundSource.initialize({
          metricsCollector,
        });

        setBasePlayer(newPlayer);
        return;
      }

      if (!args) {
        enqueueSnackbar("Unable to initialize player: no args", { variant: "error" });
        setSelectedSource(undefined);
        return;
      }

      try {
        switch (args.type) {
          case "connection": {
            const newPlayer = foundSource.initialize({
              metricsCollector,
              params: args.params,
            });
            setBasePlayer(newPlayer);

            if (args.params?.url) {
              addRecent({
                type: "connection",
                sourceId: foundSource.id,
                title: args.params.url,
                label: foundSource.displayName,
                extra: args.params,
              });
            }

            return;
          }
          case "file": {
            const handles = args.handles;
            const files = args.files;

            // files we can try loading immediately
            // We do not add these to recents entries because putting File in indexedb results in
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
              });

              setBasePlayer(newPlayer);
              return;
            } else if (handles) {
              for (const handle of handles) {
                const permission = await handle.queryPermission({ mode: "read" });
                if (!isMounted()) {
                  return;
                }

                if (permission !== "granted") {
                  const newPerm = await handle.requestPermission({ mode: "read" });
                  if (newPerm !== "granted") {
                    throw new Error(`Permission denied: ${handle.name}`);
                  }
                }
              }
              const filesHandled = await Promise.all(handles.map(async (f) => await f.getFile()));
              if (!isMounted()) {
                return;
              }

              const newPlayer = foundSource.initialize({
                files: filesHandled,
                metricsCollector,
              });

              setBasePlayer(newPlayer);
              addRecent({
                type: "file",
                title: mergeMultipleFileNames(handles.map((h) => h.name)),
                sourceId: foundSource.id,
                handles,
              });

              return;
            }
          }
        }

        enqueueSnackbar("Unable to initialize player", { variant: "error" });
      } catch (error) {
        enqueueSnackbar((error as Error).message, { variant: "error" });
      }
    },
    [playerSources, metricsCollector, enqueueSnackbar, isMounted, addRecent],
  );

  // Select a recent entry by id
  // necessary to pull out callback creation to avoid capturing the initial player in closure context
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectRecent = useCallback(
    createSelectRecentCallback(recents, selectSource, enqueueSnackbar),
    [recents, enqueueSnackbar, selectSource],
  );

  // Make a RecentSources array for the PlayerSelectionContext
  const recentSources = useMemo(() => {
    return recents.map((item) => {
      return { id: item.id, title: item.title, label: item.label };
    });
  }, [recents]);

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
        <MessagePipelineProvider player={player}>{children}</MessagePipelineProvider>
      </PlayerSelectionContext.Provider>
    </>
  );
}

/**
 * This was moved out of the PlayerManager function due to a memory leak occurring in memoized state of Start.tsx
 * that was retaining old player instances. Having this callback be defined within the PlayerManager makes it store the
 * player at instantiation within the closure context. That callback is then stored in the memoized state with its closure context.
 * The callback is updated when the player changes but part of the `Start.tsx` holds onto the formerly memoized state for an
 * unknown reason.
 * To make this function safe from storing old closure contexts in old memoized state in components where it
 * is used, it has been moved out of the PlayerManager function.
 */
function createSelectRecentCallback(
  recents: RecentRecord[],
  selectSource: (sourceId: string, dataSourceArgs: DataSourceArgs) => Promise<void>,
  enqueueSnackbar: ReturnType<typeof useSnackbar>["enqueueSnackbar"],
) {
  return (recentId: string) => {
    // find the recent from the list and initialize
    const foundRecent = recents.find((value) => value.id === recentId);
    if (!foundRecent) {
      enqueueSnackbar(`Failed to restore recent: ${recentId}`, { variant: "error" });
      return;
    }

    switch (foundRecent.type) {
      case "connection": {
        void selectSource(foundRecent.sourceId, {
          type: "connection",
          params: foundRecent.extra,
        });
        break;
      }
      case "file": {
        void selectSource(foundRecent.sourceId, {
          type: "file",
          handles: foundRecent.handles,
        });
      }
    }
  };
}
