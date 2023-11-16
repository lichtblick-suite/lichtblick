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
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { useLatest, useMountedState } from "react-use";

import { useWarnImmediateReRender } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { useNativeWindow } from "@foxglove/studio-base/context/NativeWindowContext";
import PlayerSelectionContext, {
  DataSourceArgs,
  IDataSourceFactory,
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import useIndexedDbRecents, { RecentRecord } from "@foxglove/studio-base/hooks/useIndexedDbRecents";
import AnalyticsMetricsCollector from "@foxglove/studio-base/players/AnalyticsMetricsCollector";
import { TopicAliasingPlayer } from "@foxglove/studio-base/players/TopicAliasingPlayer/TopicAliasingPlayer";
import { Player } from "@foxglove/studio-base/players/types";

const log = Logger.getLogger(__filename);

const EMPTY_GLOBAL_VARIABLES: GlobalVariables = Object.freeze({});

type PlayerManagerProps = {
  playerSources: IDataSourceFactory[];
};

const globalVariablesSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.globalVariables ?? EMPTY_GLOBAL_VARIABLES;
const selectTopicAliasFunctions = (catalog: ExtensionCatalog) =>
  catalog.installedTopicAliasFunctions;

export default function PlayerManager(props: PropsWithChildren<PlayerManagerProps>): JSX.Element {
  const { children, playerSources } = props;

  useWarnImmediateReRender();

  const { wrapPlayer } = useAppContext();

  const nativeWindow = useNativeWindow();

  const isMounted = useMountedState();

  const analytics = useAnalytics();
  const metricsCollector = useMemo(() => new AnalyticsMetricsCollector(analytics), [analytics]);

  const [basePlayer, setBasePlayer] = useState<Player | undefined>();

  const globalVariables = useCurrentLayoutSelector(globalVariablesSelector);

  const topicAliasFunctions = useExtensionCatalog(selectTopicAliasFunctions);

  const { recents, addRecent } = useIndexedDbRecents();

  // We don't want to recreate the player when the these variables change, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array to the player useMemo.
  //
  // Updating the player with new values in handled by effects below the player useMemo or within
  // the message pipeline
  const globalVariablesRef = useLatest(globalVariables);

  // Initialize the topic aliasing player with the alias functions and global variables we
  // have at first load. Any changes in alias functions caused by dynamically loaded
  // extensions or new variables have to be set separately because we can only construct
  // the wrapping player once since the underlying player doesn't allow us set a new
  // listener after the initial listener is set.
  const [initialTopicAliasFunctions] = useState(topicAliasFunctions);
  const [initialGlobalVariables] = useState(globalVariables);
  const topicAliasPlayer = useMemo(() => {
    if (!basePlayer) {
      return undefined;
    }

    return new TopicAliasingPlayer(
      basePlayer,
      initialTopicAliasFunctions ?? [],
      initialGlobalVariables,
    );
  }, [basePlayer, initialGlobalVariables, initialTopicAliasFunctions]);

  // Topic aliases can change if we hot load a new extension with new alias functions.
  useEffect(() => {
    if (topicAliasFunctions !== initialTopicAliasFunctions) {
      topicAliasPlayer?.setAliasFunctions(topicAliasFunctions ?? []);
    }
  }, [initialTopicAliasFunctions, topicAliasPlayer, topicAliasFunctions]);

  // Topic alias player needs updated global variables.
  useEffect(() => {
    if (globalVariables !== initialGlobalVariables) {
      topicAliasPlayer?.setGlobalVariables(globalVariables);
    }
  }, [globalVariables, initialGlobalVariables, topicAliasPlayer]);

  const player = useMemo(() => {
    if (!topicAliasPlayer) {
      return undefined;
    }

    const wrappedPlayer = wrapPlayer(topicAliasPlayer);
    wrappedPlayer.setGlobalVariables(globalVariablesRef.current);
    return wrappedPlayer;
  }, [topicAliasPlayer, wrapPlayer, globalVariablesRef]);

  const { enqueueSnackbar } = useSnackbar();

  const [selectedSource, setSelectedSource] = useState<IDataSourceFactory | undefined>();

  const selectSource = useCallback(
    async (sourceId: string, args?: DataSourceArgs) => {
      log.debug(`Select Source: ${sourceId}`);

      // Clear any previous represented filename
      void nativeWindow?.setRepresentedFilename(undefined);

      const foundSource = playerSources.find(
        (source) => source.id === sourceId || source.legacyIds?.includes(sourceId),
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
            const handle = args.handle;
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

              // If we are selecting a single file, the desktop environment might have features to
              // show the user which file they've selected (i.e. macOS proxy icon)
              if (file) {
                void nativeWindow?.setRepresentedFilename((file as { path?: string }).path); // File.path is added by Electron
              }

              setBasePlayer(newPlayer);
              return;
            } else if (handle) {
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

              const file = await handle.getFile();
              if (!isMounted()) {
                return;
              }

              // If we are selecting a single file, the desktop environment might have features to
              // show the user which file they've selected (i.e. macOS proxy icon)
              void nativeWindow?.setRepresentedFilename((file as { path?: string }).path); // File.path is added by Electron

              const newPlayer = foundSource.initialize({
                file,
                metricsCollector,
              });

              setBasePlayer(newPlayer);
              addRecent({
                type: "file",
                title: handle.name,
                sourceId: foundSource.id,
                handle,
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
    [playerSources, metricsCollector, enqueueSnackbar, isMounted, addRecent, nativeWindow],
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
        <MessagePipelineProvider player={player} globalVariables={globalVariablesRef.current}>
          {children}
        </MessagePipelineProvider>
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
          handle: foundRecent.handle,
        });
      }
    }
  };
}
