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

import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { connect, ConnectedProps } from "react-redux";
import { useMountedState } from "react-use";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import {
  setUserNodeDiagnostics,
  addUserNodeLogs,
  setUserNodeRosLib,
} from "@foxglove-studio/app/actions/userNodes";
import DocumentDropListener from "@foxglove-studio/app/components/DocumentDropListener";
import DropOverlay from "@foxglove-studio/app/components/DropOverlay";
import {
  MaybePlayer,
  MessagePipelineProvider,
} from "@foxglove-studio/app/components/MessagePipeline";
import { useAnalytics } from "@foxglove-studio/app/context/AnalyticsContext";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import PlayerSelectionContext, {
  PlayerSelection,
  PlayerSourceDefinition,
} from "@foxglove-studio/app/context/PlayerSelectionContext";
import { CoreDataProviders } from "@foxglove-studio/app/dataProviders/constants";
import { getRemoteBagGuid } from "@foxglove-studio/app/dataProviders/getRemoteBagGuid";
import {
  getLocalBagDescriptor,
  getRemoteBagDescriptor,
} from "@foxglove-studio/app/dataProviders/standardDataProviderDescriptors";
import useElectronFilesToOpen from "@foxglove-studio/app/hooks/useElectronFilesToOpen";
import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { usePrompt } from "@foxglove-studio/app/hooks/usePrompt";
import AnalyticsMetricsCollector from "@foxglove-studio/app/players/AnalyticsMetricsCollector";
import OrderedStampPlayer from "@foxglove-studio/app/players/OrderedStampPlayer";
import Ros1Player from "@foxglove-studio/app/players/Ros1Player";
import RosbridgePlayer from "@foxglove-studio/app/players/RosbridgePlayer";
import UserNodePlayer from "@foxglove-studio/app/players/UserNodePlayer";
import {
  buildPlayerFromDescriptor,
  BuildPlayerOptions,
} from "@foxglove-studio/app/players/buildPlayer";
import { Player } from "@foxglove-studio/app/players/types";
import { State } from "@foxglove-studio/app/reducers";
import { AppError } from "@foxglove-studio/app/util/errors";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { useShallowMemo } from "@foxglove-studio/app/util/hooks";
import { parseInputUrl } from "@foxglove-studio/app/util/url";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

type BuiltPlayer = {
  player: Player;
  sources: string[];
};

function buildPlayerFromFiles(files: File[], options: BuildPlayerOptions): BuiltPlayer {
  if (files.length === 1) {
    return {
      player: buildPlayerFromDescriptor(getLocalBagDescriptor(files[0] as File), options),
      sources: files.map((file) => String(file.name)),
    };
  } else if (files.length === 2) {
    return {
      player: buildPlayerFromDescriptor(
        {
          name: CoreDataProviders.CombinedDataProvider,
          args: {},
          children: [
            getLocalBagDescriptor(files[0] as File),
            {
              name: CoreDataProviders.RenameDataProvider,
              args: { prefix: SECOND_SOURCE_PREFIX },
              children: [getLocalBagDescriptor(files[1] as File)],
            },
          ],
        },
        options,
      ),
      sources: files.map((file) => String(file.name)),
    };
  }
  throw new Error(`Unsupported number of files: ${files.length}`);
}

async function buildPlayerFromBagURLs(
  urls: string[],
  options: BuildPlayerOptions,
): Promise<BuiltPlayer> {
  const guids = await Promise.all(urls.map(getRemoteBagGuid));

  if (urls.length === 1) {
    return {
      player: buildPlayerFromDescriptor(
        getRemoteBagDescriptor(urls[0] as string, guids[0], options),
        options,
      ),
      sources: urls.map((url) => url.toString()),
    };
  } else if (urls.length === 2) {
    return {
      player: buildPlayerFromDescriptor(
        {
          name: CoreDataProviders.CombinedDataProvider,
          args: {},
          children: [
            getRemoteBagDescriptor(urls[0] as string, guids[0], options),
            {
              name: CoreDataProviders.RenameDataProvider,
              args: { prefix: SECOND_SOURCE_PREFIX },
              children: [getRemoteBagDescriptor(urls[1] as string, guids[1], options)],
            },
          ],
        },
        options,
      ),
      sources: urls.map((url) => url.toString()),
    };
  }
  throw new Error(`Unsupported number of urls: ${urls.length}`);
}

// Based on a source type, prompt the user for additional input and return a function to build the
// requested player. The user input and actual building of the player are in separate async
// operations so the player manager can delay clearing out the old player and entering the
// "constructing" state until the user selection has completed. Returns undefined if the user
// cancels the operation.
//
// TODO(jacob): can we reduce the indirection here by making it so we can always immediately
// construct a player, remove maybePlayer and remove CONSTRUCTING from the enum? This would require
// changes to the GUID fetching in buildPlayerFromBagURLs.
async function getPlayerBuilderFromUserSelection(
  definition: PlayerSourceDefinition,
  usedFiles: { current: File[] },
  prompt: ReturnType<typeof usePrompt>,
  options: BuildPlayerOptions,
): Promise<(() => Promise<BuiltPlayer>) | undefined> {
  options.metricsCollector.setProperty("player", definition.type);

  switch (definition.type) {
    case "file": {
      let file: File;
      try {
        const [fileHandle] = await showOpenFilePicker({
          types: [{ accept: { "application/octet-stream": [".bag"] } }],
        });
        file = await fileHandle.getFile();
      } catch (error) {
        if (error.name === "AbortError") {
          return undefined;
        }
        throw error;
      }
      return async () => {
        usedFiles.current = [file];
        return buildPlayerFromFiles(usedFiles.current, options);
      };
    }
    case "ros1-core": {
      const url = await prompt({
        title: "ROS 1 TCP connection",
        placeholder: "localhost:11311",
        value: OsContextSingleton?.getEnvVar("ROS_MASTER_URI") ?? "localhost:11311",
        transformer: (str) => {
          const result = parseInputUrl(str, "ros:", {
            "http:": { port: 80 },
            "https:": { port: 443 },
            "ros:": { protocol: "http:", port: 11311 },
          });
          if (result == undefined) {
            throw new AppError(
              "Invalid ROS URL. See the ROS_MASTER_URI at http://wiki.ros.org/ROS/EnvironmentVariables for more info.",
            );
          }
          return result;
        },
      });
      if (url == undefined) {
        return undefined;
      }
      return async () => ({
        player: new Ros1Player(url, options.metricsCollector),
        sources: [url],
      });
    }
    case "ws": {
      const url = await prompt({
        title: "WebSocket connection",
        placeholder: "ws://localhost:9090",
        value: "ws://localhost:9090",
        transformer: (str) => {
          const result = parseInputUrl(str, "http:", {
            "http:": { protocol: "ws:", port: 9090 },
            "https:": { protocol: "wss:", port: 9090 },
            "ws:": { port: 9090 },
            "wss:": { port: 9090 },
            "ros:": { protocol: "ws:", port: 9090 },
          });
          if (result == undefined) {
            throw new AppError(
              "Invalid rosbridge WebSocket URL. Use the ws:// or wss:// protocol.",
            );
          }
          return result;
        },
      });
      if (url == undefined) {
        return undefined;
      }

      return async () => ({
        player: new RosbridgePlayer(url, options.metricsCollector),
        sources: [url],
      });
    }
    case "http": {
      const url = await prompt({
        title: "Remote bag file",
        placeholder: "https://example.com/file.bag",
        transformer: (str) => {
          const result = parseInputUrl(str, "https:", {
            "http:": { port: 80 },
            "https:": { port: 443 },
            "ftp:": { port: 21 },
          });
          if (result == undefined) {
            throw new AppError(
              "Invalid bag URL. Use a http:// or https:// URL of a web hosted bag file.",
            );
          }
          return result;
        },
      });
      if (url == undefined) {
        return undefined;
      }

      return () => buildPlayerFromBagURLs([url], options);
    }
  }
}

const connector = connect(
  (state: State, _ownProps: OwnProps) => ({
    messageOrder: state.persistedState.panels.playbackConfig.messageOrder,
    userNodes: state.persistedState.panels.userNodes,
    globalVariables: state.persistedState.panels.globalVariables,
  }),
  {
    setUserNodeDiagnostics,
    addUserNodeLogs,
    setUserNodeRosLib,
  },
);

type ReduxProps = ConnectedProps<typeof connector>;

type OwnProps = PropsWithChildren<{
  playerSources: PlayerSourceDefinition[];
}>;

type Props = OwnProps & ReduxProps;

function PlayerManager({
  children,
  playerSources,
  messageOrder,
  userNodes,
  globalVariables,
  setUserNodeDiagnostics: setDiagnostics,
  addUserNodeLogs: setLogs,
  setUserNodeRosLib: setRosLib,
}: Props) {
  const usedFiles = useRef<File[]>([]);
  const globalVariablesRef = useRef<GlobalVariables>(globalVariables);
  const [maybePlayer, setMaybePlayer] = useState<MaybePlayer<OrderedStampPlayer>>({});
  const [currentSourceName, setCurrentSourceName] = useState<string | undefined>(undefined);
  const prompt = usePrompt();
  const isMounted = useMountedState();

  // We don't want to recreate the player when the message order changes, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array below to defeat the linter.
  const [initialMessageOrder] = useState(messageOrder);

  // Load a new player using the given definition -- passed as a function so that the asynchronous
  // operation can be included as part of the "loading" state we pass in to MessagePipelineProvider.
  const setPlayer = useCallback(
    async (buildPlayer: () => Promise<BuiltPlayer | undefined>) => {
      setMaybePlayer({ loading: true });
      try {
        const builtPlayer = await buildPlayer();
        if (!builtPlayer) {
          setMaybePlayer({ player: undefined });
          return;
        }
        setCurrentSourceName(builtPlayer.sources.join(","));

        const userNodePlayer = new UserNodePlayer(builtPlayer.player, {
          setUserNodeDiagnostics: setDiagnostics,
          addUserNodeLogs: setLogs,
          setUserNodeRosLib: setRosLib,
        });
        const headerStampPlayer = new OrderedStampPlayer(userNodePlayer, initialMessageOrder);
        headerStampPlayer.setGlobalVariables(globalVariablesRef.current);
        setMaybePlayer({ player: headerStampPlayer });
      } catch (error) {
        setMaybePlayer({ error });
      }
    },
    [setDiagnostics, setLogs, setRosLib, initialMessageOrder],
  );

  const buildPlayerOptions: BuildPlayerOptions = useShallowMemo({
    diskBagCaching: useExperimentalFeature("diskBagCaching"),
    unlimitedMemoryCache: useExperimentalFeature("unlimitedMemoryCache"),
    metricsCollector: new AnalyticsMetricsCollector(useAnalytics()),
  });

  useEffect(() => {
    maybePlayer.player?.setMessageOrder(messageOrder);
  }, [messageOrder, maybePlayer]);
  useEffect(() => {
    maybePlayer.player?.setUserNodes(userNodes);
  }, [userNodes, maybePlayer]);

  const dropHandler = useCallback(
    ({ files, shiftPressed }: { files: FileList | File[]; shiftPressed: boolean }) => {
      if (files.length === 0) {
        return;
      }

      if (shiftPressed) {
        usedFiles.current = [...usedFiles.current, ...files];
      } else {
        usedFiles.current = [...files];
      }
      setPlayer(async () => buildPlayerFromFiles(usedFiles.current, buildPlayerOptions));
    },
    [setPlayer, buildPlayerOptions],
  );

  const selectSource = useCallback(
    async (definition: PlayerSourceDefinition) => {
      try {
        const builder = await getPlayerBuilderFromUserSelection(
          definition,
          usedFiles,
          prompt,
          buildPlayerOptions,
        );
        if (builder && isMounted()) {
          setPlayer(builder);
        }
      } catch (error) {
        setMaybePlayer({ error });
      }
    },
    [setPlayer, prompt, buildPlayerOptions, isMounted],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    const file = filesToOpen?.[0];
    if (!file) {
      return;
    }

    usedFiles.current = [file];
    setPlayer(async () => buildPlayerFromFiles(usedFiles.current, buildPlayerOptions));
  }, [setPlayer, filesToOpen, buildPlayerOptions]);

  const value: PlayerSelection = {
    selectSource,
    // Expose a simple way to load a demo bag for first launch onboarding.
    // In the future we may want to replace this limited API with something more cohesive
    // that exposes the different buildPlayerFromX methods above. At the same time,
    // the prompt() responsibilities could be moved out of the PlayerManager.
    setPlayerFromDemoBag: useCallback(
      () => setPlayer(() => buildPlayerFromBagURLs([DEMO_BAG_URL], buildPlayerOptions)),
      [setPlayer, buildPlayerOptions],
    ),
    availableSources: playerSources,
    currentSourceName,
  };

  return (
    <>
      <DocumentDropListener filesSelected={dropHandler}>
        <DropOverlay>
          <div style={{ fontSize: "4em", marginBottom: "1em" }}>Drop a bag file to load it!</div>
          <div style={{ fontSize: "2em" }}>
            (hold SHIFT while dropping a second bag file to add it
            <br />
            with all topics prefixed with {SECOND_SOURCE_PREFIX})
          </div>
        </DropOverlay>
      </DocumentDropListener>
      <PlayerSelectionContext.Provider value={value}>
        <MessagePipelineProvider maybePlayer={maybePlayer} globalVariables={globalVariables}>
          {children}
        </MessagePipelineProvider>
      </PlayerSelectionContext.Provider>
    </>
  );
}

export default connector(PlayerManager);
