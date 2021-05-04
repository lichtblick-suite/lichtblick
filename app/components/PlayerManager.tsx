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
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connect, ConnectedProps } from "react-redux";
import { useLocalStorage, useMountedState } from "react-use";
import { URL } from "universal-url";

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import {
  setUserNodeDiagnostics,
  addUserNodeLogs,
  setUserNodeRosLib,
} from "@foxglove-studio/app/actions/userNodes";
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
import { useAppConfigurationValue } from "@foxglove-studio/app/hooks/useAppConfigurationValue";
import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { usePrompt } from "@foxglove-studio/app/hooks/usePrompt";
import useShallowMemo from "@foxglove-studio/app/hooks/useShallowMemo";
import useWarnImmediateReRender from "@foxglove-studio/app/hooks/useWarnImmediateReRender";
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
import Storage from "@foxglove-studio/app/util/Storage";
import { AppError } from "@foxglove-studio/app/util/errors";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { parseInputUrl } from "@foxglove-studio/app/util/url";
import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

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

type FactoryOptions = {
  source: PlayerSourceDefinition;
  sourceOptions: Record<string, unknown>;
  skipRestore: boolean;
  prompt: ReturnType<typeof usePrompt>;
  storage: Storage;
};

async function localBagFileSource(options: FactoryOptions) {
  let file: File;

  // future enhancement would be to store the fileHandle in indexeddb and try to restore
  // fileHandles can be stored in indexeddb but not localstorage
  if (!options.skipRestore) {
    return;
  }

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
  return async (playerOptions: BuildPlayerOptions) => {
    return buildPlayerFromFiles([file], playerOptions);
  };
}

async function remoteBagFileSource(options: FactoryOptions) {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;

  if (options.skipRestore ?? false) {
    maybeUrl = await options.prompt({
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
  } else {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);
  return (playerOptions: BuildPlayerOptions) => buildPlayerFromBagURLs([url], playerOptions);
}

async function rosbridgeSource(options: FactoryOptions) {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;

  if (options.skipRestore ?? false) {
    const value = options.storage.getItem<string>(storageCacheKey) ?? "ws://localhost:9090";
    maybeUrl = await options.prompt({
      title: "WebSocket connection",
      placeholder: "ws://localhost:9090",
      value,
      transformer: (str) => {
        const result = parseInputUrl(str, "http:", {
          "http:": { protocol: "ws:", port: 9090 },
          "https:": { protocol: "wss:", port: 9090 },
          "ws:": { port: 9090 },
          "wss:": { port: 9090 },
          "ros:": { protocol: "ws:", port: 9090 },
        });
        if (result == undefined) {
          throw new AppError("Invalid rosbridge WebSocket URL. Use the ws:// or wss:// protocol.");
        }
        return result;
      },
    });
  } else {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);
  return async (playerOptions: BuildPlayerOptions) => ({
    player: new RosbridgePlayer(url, playerOptions.metricsCollector),
    sources: [url],
  });
}

async function roscoreSource(options: FactoryOptions) {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;

  if (options.skipRestore ?? false) {
    const value = options.storage.getItem<string>(storageCacheKey);

    maybeUrl = await options.prompt({
      title: "ROS 1 TCP connection",
      placeholder: "localhost:11311",
      value: value ?? OsContextSingleton?.getEnvVar("ROS_MASTER_URI") ?? "localhost:11311",
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
  } else {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);

  const hostname = options.sourceOptions.rosHostname as string | undefined;

  return async (playerOptions: BuildPlayerOptions) => ({
    player: new Ros1Player({ url, hostname, metricsCollector: playerOptions.metricsCollector }),
    sources: [url],
  });
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
  useWarnImmediateReRender();

  const usedFiles = useRef<File[]>([]);
  const globalVariablesRef = useRef<GlobalVariables>(globalVariables);
  const [maybePlayer, setMaybePlayer] = useState<MaybePlayer<OrderedStampPlayer>>({});
  const [currentSourceName, setCurrentSourceName] = useState<string | undefined>(undefined);
  const isMounted = useMountedState();

  // We don't want to recreate the player when the message order changes, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array below to defeat the linter.
  const [initialMessageOrder] = useState(messageOrder);

  const analytics = useAnalytics();
  const metricsCollector = useMemo(() => {
    return new AnalyticsMetricsCollector(analytics);
  }, [analytics]);

  const buildPlayerOptions: BuildPlayerOptions = useShallowMemo({
    diskBagCaching: useExperimentalFeature("diskBagCaching"),
    unlimitedMemoryCache: useExperimentalFeature("unlimitedMemoryCache"),
    metricsCollector: metricsCollector,
  });

  // Load a new player using the given definition -- passed as a function so that the asynchronous
  // operation can be included as part of the "loading" state we pass in to MessagePipelineProvider.
  const setPlayer = useCallback(
    async (buildPlayer: (options: BuildPlayerOptions) => Promise<BuiltPlayer | undefined>) => {
      setMaybePlayer({ loading: true });
      try {
        const builtPlayer = await buildPlayer(buildPlayerOptions);
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
    [buildPlayerOptions, setDiagnostics, setLogs, setRosLib, initialMessageOrder],
  );

  useEffect(() => {
    maybePlayer.player?.setMessageOrder(messageOrder);
  }, [messageOrder, maybePlayer]);
  useEffect(() => {
    maybePlayer.player?.setUserNodes(userNodes);
  }, [userNodes, maybePlayer]);

  // Based on a source type, prompt the user for additional input and return a function to build the
  // requested player. The user input and actual building of the player are in separate async
  // operations so the player manager can delay clearing out the old player and entering the
  // "constructing" state until the user selection has completed. Returns undefined if the user
  // cancels the operation.
  //
  // TODO(jacob): can we reduce the indirection here by making it so we can always immediately
  // construct a player, remove maybePlayer and remove CONSTRUCTING from the enum? This would require
  // changes to the GUID fetching in buildPlayerFromBagURLs.
  const lookupPlayerBuilderFactory = useCallback((definition: PlayerSourceDefinition) => {
    switch (definition.type) {
      case "file":
        return localBagFileSource;
      case "ros1-core":
        return roscoreSource;
      case "ws":
        return rosbridgeSource;
      case "http":
        return remoteBagFileSource;
      default:
        return;
    }
  }, []);

  useEffect(() => {
    const links = OsContextSingleton?.getDeepLinks() ?? [];
    const firstLink = links[0];
    if (firstLink == undefined) {
      return;
    }

    try {
      const url = new URL(firstLink);
      // only support the open command

      // Test if the pathname matches //open or //open/
      if (!/\/\/open\/?/.test(url.pathname)) {
        return;
      }

      // only support rosbag urls
      const type = url.searchParams.get("type");
      const bagUrl = url.searchParams.get("url");
      if (type !== "rosbag" || bagUrl == undefined) {
        return;
      }
      setPlayer(async (options: BuildPlayerOptions) => buildPlayerFromBagURLs([bagUrl], options));
    } catch (err) {
      log.error(err);
    }
  }, [setPlayer]);

  const prompt = usePrompt();
  const storage = useMemo(() => new Storage(), []);

  const [rosHostname] = useAppConfigurationValue<string>(AppSetting.ROS1_ROS_HOSTNAME);

  const [savedSource, setSavedSource] = useLocalStorage<PlayerSourceDefinition>(
    "studio.playermanager.selected-source",
  );

  const selectSource = useCallback(
    async (selectedSource: PlayerSourceDefinition, restore: boolean = false) => {
      log.debug(`Select Source: ${selectedSource.name} ${selectedSource.type}`);
      setSavedSource(selectedSource);

      try {
        metricsCollector.setProperty("player", selectedSource.type);

        const createPlayerBuilder = lookupPlayerBuilderFactory(selectedSource);
        if (!createPlayerBuilder) {
          throw new Error(`Could not create a player for ${selectedSource.name}`);
        }

        const sourceOptions = { rosHostname };

        const playerBuilder = await createPlayerBuilder({
          source: selectedSource,
          sourceOptions,
          skipRestore: !restore,
          prompt,
          storage,
        });
        if (playerBuilder && isMounted()) {
          setPlayer(playerBuilder);
        }
      } catch (error) {
        setMaybePlayer({ error });
      }
    },
    [
      isMounted,
      lookupPlayerBuilderFactory,
      metricsCollector,
      prompt,
      rosHostname,
      setPlayer,
      setSavedSource,
      storage,
    ],
  );

  // restore the saved source on first mount
  useLayoutEffect(() => {
    if (savedSource) {
      selectSource(savedSource, true /* restore */);
    }
    // we only run the layout effect on first mount - never again even if the saved source changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PlayerSelection = {
    selectSource,
    setPlayerFromFiles: useCallback(
      (files: File[], { append = false }: { append?: boolean } = {}) => {
        if (files.length === 0) {
          return;
        }

        if (append) {
          usedFiles.current = [...usedFiles.current, ...files];
        } else {
          usedFiles.current = [...files];
        }
        setPlayer(async (options: BuildPlayerOptions) =>
          buildPlayerFromFiles(usedFiles.current, options),
        );
      },
      [setPlayer],
    ),
    // Expose a simple way to load a demo bag for first launch onboarding.
    // In the future we may want to replace this limited API with something more cohesive
    // that exposes the different buildPlayerFromX methods above. At the same time,
    // the prompt() responsibilities could be moved out of the PlayerManager.
    setPlayerFromDemoBag: useCallback(
      () =>
        setPlayer((options: BuildPlayerOptions) => buildPlayerFromBagURLs([DEMO_BAG_URL], options)),
      [setPlayer],
    ),
    availableSources: playerSources,
    currentSourceName,
  };

  return (
    <>
      <PlayerSelectionContext.Provider value={value}>
        <MessagePipelineProvider maybePlayer={maybePlayer} globalVariables={globalVariables}>
          {children}
        </MessagePipelineProvider>
      </PlayerSelectionContext.Provider>
    </>
  );
}

export default connector(PlayerManager);
