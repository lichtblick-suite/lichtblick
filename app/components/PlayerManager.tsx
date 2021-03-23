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

import {
  setUserNodeDiagnostics,
  addUserNodeLogs,
  setUserNodeRosLib,
} from "@foxglove-studio/app/actions/userNodes";
import DocumentDropListener from "@foxglove-studio/app/components/DocumentDropListener";
import DropOverlay from "@foxglove-studio/app/components/DropOverlay";
import { MessagePipelineProvider } from "@foxglove-studio/app/components/MessagePipeline";
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
import useUserNodes from "@foxglove-studio/app/hooks/useUserNodes";
import OrderedStampPlayer from "@foxglove-studio/app/players/OrderedStampPlayer";
import RosbridgePlayer from "@foxglove-studio/app/players/RosbridgePlayer";
import UserNodePlayer from "@foxglove-studio/app/players/UserNodePlayer";
import {
  buildPlayerFromDescriptor,
  BuildPlayerOptions,
} from "@foxglove-studio/app/players/buildPlayer";
import { Player } from "@foxglove-studio/app/players/types";
import { State } from "@foxglove-studio/app/reducers";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { useShallowMemo } from "@foxglove-studio/app/util/hooks";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

type BuiltPlayer = {
  player: Player;
  sources: string[];
};

function buildPlayerFromFiles(files: File[], options: BuildPlayerOptions): BuiltPlayer {
  if (files.length === 1) {
    return {
      player: buildPlayerFromDescriptor(getLocalBagDescriptor(files[0]!), options),
      sources: files.map((file) => String(file.name)),
    };
  } else if (files.length === 2) {
    return {
      player: buildPlayerFromDescriptor(
        {
          name: CoreDataProviders.CombinedDataProvider,
          args: {},
          children: [
            getLocalBagDescriptor(files[0]!),
            {
              name: CoreDataProviders.RenameDataProvider,
              args: { prefix: SECOND_SOURCE_PREFIX },
              children: [getLocalBagDescriptor(files[1]!)],
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
        getRemoteBagDescriptor(urls[0]!, guids[0], options),
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
            getRemoteBagDescriptor(urls[0]!, guids[0], options),
            {
              name: CoreDataProviders.RenameDataProvider,
              args: { prefix: SECOND_SOURCE_PREFIX },
              children: [getRemoteBagDescriptor(urls[1]!, guids[1], options)],
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
  const [player, setPlayerInternal] = useState<OrderedStampPlayer | undefined>();
  const [currentSourceName, setCurrentSourceName] = useState<string | undefined>(undefined);
  const prompt = usePrompt();

  // We don't want to recreate the player when the message order changes, but we do want to
  // initialize it with the right order, so make a variable for its initial value we can use in the
  // dependency array below to defeat the linter.
  const [initialMessageOrder] = useState(messageOrder);
  const buildPlayer = useCallback(
    (playerDefinition: BuiltPlayer) => {
      setCurrentSourceName(playerDefinition.sources.join(","));

      const userNodePlayer = new UserNodePlayer(playerDefinition.player, {
        setUserNodeDiagnostics: setDiagnostics,
        addUserNodeLogs: setLogs,
        setUserNodeRosLib: setRosLib,
      });
      const headerStampPlayer = new OrderedStampPlayer(userNodePlayer, initialMessageOrder);
      headerStampPlayer.setGlobalVariables(globalVariablesRef.current);
      setPlayerInternal(headerStampPlayer);
    },
    [setDiagnostics, setLogs, setRosLib, initialMessageOrder],
  );

  const buildPlayerOptions = useShallowMemo({
    diskBagCaching: useExperimentalFeature("diskBagCaching"),
    unlimitedMemoryCache: useExperimentalFeature("unlimitedMemoryCache"),
  });

  useEffect(() => {
    if (player) {
      player.setMessageOrder(messageOrder);
    }
  }, [messageOrder, player]);

  useUserNodes({ nodePlayer: player, userNodes });

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
      buildPlayer(buildPlayerFromFiles(usedFiles.current, buildPlayerOptions));
    },
    [buildPlayer, buildPlayerOptions],
  );

  const selectSource = useCallback(
    async (definition: PlayerSourceDefinition) => {
      switch (definition.type) {
        case "file": {
          // The main thread simulated a mouse click for us which allows us to invoke input.click();
          // The idea is to move handling of opening the file to the renderer thread
          const input = document.createElement("input");
          input.setAttribute("type", "file");
          input.setAttribute("accept", ".bag");

          input.addEventListener(
            "input",
            () => {
              const file = input?.files?.[0];
              if (file) {
                usedFiles.current = [file];
                buildPlayer(buildPlayerFromFiles(usedFiles.current, buildPlayerOptions));
              }
            },
            { once: true },
          );

          input.click();

          break;
        }
        case "ws": {
          const result = await prompt({
            placeholder: "ws://localhost:9090",
          });
          if (result === undefined || result.length === 0) {
            return;
          }

          buildPlayer({
            player: new RosbridgePlayer(result),
            sources: [result],
          });
          break;
        }
        case "http": {
          const result = await prompt({
            placeholder: "http://example.com/file.bag",
          });
          if (result === undefined || result.length === 0) {
            return;
          }

          const builtPlayer = await buildPlayerFromBagURLs([result], buildPlayerOptions);
          buildPlayer(builtPlayer);
        }
      }
    },
    [buildPlayer, prompt, buildPlayerOptions],
  );

  // files the main thread told us to open
  const filesToOpen = useElectronFilesToOpen();
  useEffect(() => {
    const file = filesToOpen?.[0];
    if (!file) {
      return;
    }

    usedFiles.current = [file];
    buildPlayer(buildPlayerFromFiles(usedFiles.current, buildPlayerOptions));
  }, [buildPlayer, filesToOpen, buildPlayerOptions]);

  const value: PlayerSelection = {
    selectSource,
    // Expose a simple way to load a demo bag for first launch onboarding.
    // In the future we may want to replace this limited API with something more cohesive
    // that exposes the different buildPlayerFromX methods above. At the same time,
    // the prompt() responsibilities could be moved out of the PlayerManager.
    setPlayerFromDemoBag: async () =>
      buildPlayer(await buildPlayerFromBagURLs([DEMO_BAG_URL], buildPlayerOptions)),
    availableSources: playerSources,
    currentSourceName,
    currentPlayer: player,
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
        <MessagePipelineProvider player={player} globalVariables={globalVariables}>
          {children}
        </MessagePipelineProvider>
      </PlayerSelectionContext.Provider>
    </>
  );
}

export default connector(PlayerManager);
