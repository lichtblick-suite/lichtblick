// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { Immutable } from "@foxglove/studio";
import { messagePathStructures } from "@foxglove/studio-base/components/MessagePathSyntax/messagePathsForDatatype";
import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { enumValuesByDatatypeAndField } from "@foxglove/studio-base/util/enums";

import { initAccumulated, accumulate, buildPlot } from "./accumulate";
import { rebuildClient, sendData, mapClients, noEffects, keepEffects, getAllTopics } from "./state";
import { State, StateAndEffects, Client, SideEffects } from "./types";
import { Messages } from "../internalTypes";
import { isSingleMessage } from "../params";

export function receiveMetadata(
  topics: readonly Topic[],
  datatypes: Immutable<RosDatatypes>,
  state: State,
): State {
  return {
    ...state,
    metadata: {
      topics,
      datatypes,
      enumValues: enumValuesByDatatypeAndField(datatypes),
      structures: messagePathStructures(datatypes),
    },
  };
}

export function evictCache(state: State): State {
  const { blocks, current } = state;
  const topics = getAllTopics(state);
  return {
    ...state,
    blocks: R.pick(topics, blocks),
    current: R.pick(topics, current),
  };
}

export function addBlock(block: Messages, resetTopics: string[], state: State): StateAndEffects {
  const { blocks, pending, metadata, globalVariables } = state;

  const blockTopics = Object.keys(block);
  const clientTopics = getAllTopics(state);
  const [usedTopics, unusedTopics] = R.partition(
    (topic) => clientTopics.includes(topic),
    blockTopics,
  );
  const usedData = R.pick(usedTopics, block);
  const unusedData = R.pick(unusedTopics, block);

  const newState = {
    ...state,
    pending: R.mergeWith(R.concat, pending, unusedData),
    blocks: R.pipe(
      // Remove data for any topics that have been reset
      R.omit(resetTopics),
      // Merge the new block into the existing blocks
      (newBlocks) => R.mergeWith(R.concat, newBlocks, usedData),
    )(blocks),
  };

  return mapClients((client, { blocks: newBlocks }): [Client, SideEffects] => {
    const { id, params } = client;
    const relevantTopics = R.intersection(blockTopics, client.topics);
    const shouldReset = R.intersection(relevantTopics, resetTopics).length > 0;
    if (params == undefined || isSingleMessage(params) || relevantTopics.length === 0) {
      return [client, []];
    }

    return [
      {
        ...client,
        blocks: accumulate(
          metadata,
          globalVariables,
          shouldReset ? initAccumulated(client.topics) : client.blocks,
          params,
          newBlocks,
        ),
      },
      [rebuildClient(id)],
    ];
  })(newState);
}

export function addCurrent(events: readonly MessageEvent[], state: State): StateAndEffects {
  const { current: oldCurrent } = state;
  const newState: State = {
    ...state,
    current: R.pipe(
      R.groupBy((v: MessageEvent) => v.topic),
      R.mergeWith(R.concat, oldCurrent),
    )(events),
  };

  return R.pipe(
    mapClients((client): [Client, SideEffects] => {
      const { current, metadata, globalVariables } = newState;
      const { id, params } = client;
      if (params == undefined) {
        return noEffects(client);
      }

      if (isSingleMessage(params)) {
        const plotData = buildPlot(
          metadata,
          globalVariables,
          params,
          R.map((messages) => messages.slice(-1), current),
        );
        return [client, [sendData(id, plotData)]];
      }

      return [
        {
          ...client,
          current: accumulate(metadata, globalVariables, client.current, params, current),
        },
        [rebuildClient(id)],
      ];
    }),
    keepEffects(evictCache),
  )(newState);
}

export function clearCurrent(state: State): StateAndEffects {
  const newState = {
    ...state,
    current: {},
  };

  return mapClients((client) => {
    return [
      {
        ...client,
        current: initAccumulated(client.topics),
      },
      [rebuildClient(client.id)],
    ];
  })(newState);
}
