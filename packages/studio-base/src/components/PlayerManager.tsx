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
import { useToasts } from "react-toast-notifications";
import { useLocalStorage, useMountedState } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { MessagePipelineProvider } from "@foxglove/studio-base/components/MessagePipeline";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useCurrentLayoutSelector } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PlayerSelectionContext, {
  PlayerSelection,
  PlayerSourceDefinition,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";
import useWarnImmediateReRender from "@foxglove/studio-base/hooks/useWarnImmediateReRender";
import AnalyticsMetricsCollector from "@foxglove/studio-base/players/AnalyticsMetricsCollector";
import OrderedStampPlayer from "@foxglove/studio-base/players/OrderedStampPlayer";
import Ros1Player from "@foxglove/studio-base/players/Ros1Player";
import RosbridgePlayer from "@foxglove/studio-base/players/RosbridgePlayer";
import UserNodePlayer from "@foxglove/studio-base/players/UserNodePlayer";
import VelodynePlayer, {
  DEFAULT_VELODYNE_PORT,
} from "@foxglove/studio-base/players/VelodynePlayer";
import {
  buildPlayerFromDescriptor,
  BuildPlayerOptions,
} from "@foxglove/studio-base/players/buildPlayer";
import { buildRosbag2PlayerFromDescriptor } from "@foxglove/studio-base/players/buildRosbag2Player";
import { Player } from "@foxglove/studio-base/players/types";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import {
  getLocalBagDescriptor,
  getLocalRosbag2Descriptor,
  getRemoteBagDescriptor,
} from "@foxglove/studio-base/randomAccessDataProviders/standardDataProviderDescriptors";
import { UserNodes } from "@foxglove/studio-base/types/panels";
import Storage from "@foxglove/studio-base/util/Storage";
import { AppError } from "@foxglove/studio-base/util/errors";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
import { parseInputUrl } from "@foxglove/studio-base/util/url";

const log = Logger.getLogger(__filename);

const DEFAULT_MESSAGE_ORDER = "receiveTime";
const EMPTY_USER_NODES: UserNodes = Object.freeze({});
const EMPTY_GLOBAL_VARIABLES: GlobalVariables = Object.freeze({});

type BuiltPlayerMeta = {
  player: Player;
  sources: string[];
};

function buildPlayerFromFiles(files: File[], options: BuildPlayerOptions): BuiltPlayerMeta {
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

function buildPlayerFromBagURLs(urls: string[], options: BuildPlayerOptions): BuiltPlayerMeta {
  if (urls.length === 1) {
    return {
      player: buildPlayerFromDescriptor(
        getRemoteBagDescriptor(urls[0] as string, options),
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
            getRemoteBagDescriptor(urls[0] as string, options),
            {
              name: CoreDataProviders.RenameDataProvider,
              args: { prefix: SECOND_SOURCE_PREFIX },
              children: [getRemoteBagDescriptor(urls[1] as string, options)],
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

function buildRosbag2PlayerFromFolder(
  folder: FileSystemDirectoryHandle,
  options: BuildPlayerOptions,
): BuiltPlayerMeta {
  return {
    player: buildRosbag2PlayerFromDescriptor(getLocalRosbag2Descriptor(folder), options),
    sources: [folder.name],
  };
}

type FactoryOptions = {
  source: PlayerSourceDefinition;
  sourceOptions: Record<string, unknown>;
  playerOptions: BuildPlayerOptions;
  prompt: ReturnType<typeof usePrompt>;
  storage: Storage;
};

async function localBagFileSource(options: FactoryOptions): Promise<BuiltPlayerMeta | undefined> {
  let file: File;

  const restore = options.sourceOptions.restore ?? false;

  // future enhancement would be to store the fileHandle in indexeddb and try to restore
  // fileHandles can be stored in indexeddb but not localstorage
  if (restore) {
    return undefined;
  }

  // maybe the caller has some files they want to open
  const files = options.sourceOptions.files;
  if (files && files instanceof Array) {
    return buildPlayerFromFiles(files, options.playerOptions);
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

  return buildPlayerFromFiles([file], options.playerOptions);
}

async function localRosbag2FolderSource(
  options: FactoryOptions,
): Promise<BuiltPlayerMeta | undefined> {
  let folder: FileSystemDirectoryHandle;

  const restore = options.sourceOptions.restore ?? false;
  if (restore) {
    return undefined;
  }

  try {
    folder = await showDirectoryPicker();
  } catch (error) {
    if (error.name === "AbortError") {
      return undefined;
    }
    throw error;
  }
  return buildRosbag2PlayerFromFolder(folder, options.playerOptions);
}

async function remoteBagFileSource(options: FactoryOptions): Promise<BuiltPlayerMeta | undefined> {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;

  const restore = options.sourceOptions.restore;
  const urlOption = options.sourceOptions.url;

  if (restore) {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  } else if (urlOption && typeof urlOption === "string") {
    maybeUrl = urlOption;
  } else {
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
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);
  return buildPlayerFromBagURLs([url], options.playerOptions);
}

async function rosbridgeSource(options: FactoryOptions): Promise<BuiltPlayerMeta | undefined> {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;
  const restore = options.sourceOptions.restore;

  if (restore) {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  } else {
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
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);
  return {
    player: new RosbridgePlayer({
      url,
      metricsCollector: options.playerOptions.metricsCollector,
    }),
    sources: [url],
  };
}

async function roscoreSource(options: FactoryOptions): Promise<BuiltPlayerMeta | undefined> {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined url indicates the user canceled the prompt
  let maybeUrl;
  const restore = options.sourceOptions.restore;

  if (restore) {
    maybeUrl = options.storage.getItem<string>(storageCacheKey);
  } else {
    const value = options.storage.getItem<string>(storageCacheKey);

    const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960
    maybeUrl = await options.prompt({
      title: "ROS 1 TCP connection",
      placeholder: "localhost:11311",
      value: value ?? os?.getEnvVar("ROS_MASTER_URI") ?? "localhost:11311",
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
  }

  if (maybeUrl == undefined) {
    return undefined;
  }

  const url = maybeUrl;
  options.storage.setItem(storageCacheKey, url);

  const hostname = options.sourceOptions.rosHostname as string | undefined;

  return {
    player: new Ros1Player({
      url,
      hostname,
      metricsCollector: options.playerOptions.metricsCollector,
    }),
    sources: [url],
  };
}

async function velodyneSource(options: FactoryOptions): Promise<BuiltPlayerMeta | undefined> {
  const storageCacheKey = `studio.source.${options.source.name}`;

  // undefined port indicates the user canceled the prompt
  let maybePort;
  const restore = options.sourceOptions.restore;

  if (restore) {
    maybePort = options.storage.getItem<string>(storageCacheKey);
  } else {
    const value = options.storage.getItem<string>(storageCacheKey);

    maybePort = await options.prompt({
      title: "Velodyne LIDAR UDP port",
      placeholder: `${DEFAULT_VELODYNE_PORT}`,
      value: value ?? `${DEFAULT_VELODYNE_PORT}`,
      transformer: (str) => {
        const parsed = parseInt(str);
        if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
          throw new AppError(
            "Invalid port number. Please enter a valid UDP port number to listen for Velodyne packets",
          );
        }
        return parsed.toString();
      },
    });
  }

  if (maybePort == undefined) {
    return undefined;
  }

  const portStr = maybePort;
  const port = parseInt(portStr);
  options.storage.setItem(storageCacheKey, portStr);

  return {
    player: new VelodynePlayer({ port, metricsCollector: options.playerOptions.metricsCollector }),
    sources: [portStr],
  };
}

export default function PlayerManager({
  children,
  playerSources,
}: PropsWithChildren<{
  playerSources: PlayerSourceDefinition[];
}>): JSX.Element {
  useWarnImmediateReRender();

  const { setUserNodeDiagnostics, addUserNodeLogs, setUserNodeRosLib } = useUserNodeState();
  const userNodeActions = useShallowMemo({
    setUserNodeDiagnostics,
    addUserNodeLogs,
    setUserNodeRosLib,
  });

  const messageOrder = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data.playbackConfig.messageOrder,
  );
  const userNodes = useCurrentLayoutSelector((state) => state.selectedLayout?.data.userNodes);
  const globalVariables = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data.globalVariables ?? EMPTY_GLOBAL_VARIABLES,
  );

  const globalVariablesRef = useRef<GlobalVariables>(globalVariables);
  const [basePlayer, setBasePlayer] = useState<Player | undefined>();
  const [currentSourceName, setCurrentSourceName] = useState<string | undefined>(undefined);
  const isMounted = useMountedState();

  // We don't want to recreate the player when the message order changes, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array below to defeat the linter.
  const [initialMessageOrder] = useState(messageOrder);

  const analytics = useAnalytics();
  const metricsCollector = useMemo(() => new AnalyticsMetricsCollector(analytics), [analytics]);

  const [unlimitedMemoryCache = false] = useAppConfigurationValue<boolean>(
    AppSetting.UNLIMITED_MEMORY_CACHE,
  );
  const buildPlayerOptions: BuildPlayerOptions = useShallowMemo({
    unlimitedMemoryCache,
    metricsCollector,
  });

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

  // Based on a source type, prompt the user for additional input and return a function to build the
  // requested player.
  const lookupPlayerBuilderFactory = useCallback((definition: PlayerSourceDefinition) => {
    switch (definition.type) {
      case "ros1-local-bagfile":
        return localBagFileSource;
      case "ros2-local-bagfile":
        return localRosbag2FolderSource;
      case "ros1-socket":
        return roscoreSource;
      case "rosbridge-websocket":
        return rosbridgeSource;
      case "ros1-remote-bagfile":
        return remoteBagFileSource;
      case "velodyne-device":
        return velodyneSource;
      default:
        return;
    }
  }, []);

  const prompt = usePrompt();
  const { addToast } = useToasts();
  const storage = useMemo(() => new Storage(), []);

  const [rosHostname] = useAppConfigurationValue<string>(AppSetting.ROS1_ROS_HOSTNAME);

  const [savedSource, setSavedSource] = useLocalStorage<PlayerSourceDefinition>(
    "studio.playermanager.selected-source",
  );

  const selectSource = useCallback(
    async (selectedSource: PlayerSourceDefinition, params?: Record<string, unknown>) => {
      log.debug(`Select Source: ${selectedSource.name} ${selectedSource.type}`);
      setSavedSource(selectedSource);
      setBasePlayer(undefined);

      try {
        metricsCollector.setProperty("player", selectedSource.type);

        const buildPlayer = lookupPlayerBuilderFactory(selectedSource);
        if (!buildPlayer) {
          // This can happen when upgrading from an older version of Studio that used different
          // player names
          addToast(`Could not create a player for ${selectedSource.name}.`, {
            appearance: "error",
          });
          return;
        }

        const builtPlayerMeta = await buildPlayer({
          source: selectedSource,
          sourceOptions: { ...params, rosHostname },
          playerOptions: buildPlayerOptions,
          prompt,
          storage,
        });
        if (builtPlayerMeta && isMounted()) {
          setCurrentSourceName(builtPlayerMeta.sources.join(","));
          setBasePlayer(builtPlayerMeta.player);
        }
      } catch (error) {
        setBasePlayer(undefined);
        addToast(error.message, {
          appearance: "error",
        });
      }
    },
    [
      addToast,
      buildPlayerOptions,
      isMounted,
      lookupPlayerBuilderFactory,
      metricsCollector,
      prompt,
      rosHostname,
      setSavedSource,
      storage,
    ],
  );

  // restore the saved source on first mount
  useLayoutEffect(() => {
    if (savedSource) {
      void selectSource(savedSource, { restore: true });
    }
    // we only run the layout effect on first mount - never again even if the saved source changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PlayerSelection = {
    selectSource,
    availableSources: playerSources,
    currentSourceName,
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
