// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";
import {
  RosPath,
  MessagePathPart,
} from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { mergeSubscriptions } from "@foxglove/studio-base/components/MessagePipeline/subscriptions";
import { SubscribePayload, MessageEvent } from "@foxglove/studio-base/players/types";

import {
  ClientUpdate,
  processBlocks,
  BlockState,
  BlockUpdate,
  initBlockState,
  prepareBlockUpdate,
  refreshBlockTopics,
} from "./blocks";
import { PlotParams } from "./internalTypes";
import { getPaths } from "./params";

/**
 * A Client corresponds to a single plot panel.
 */
export type Client = {
  params: PlotParams | undefined;
  // This keeps track of the data we've sent to the worker for this client.
  blockState: BlockState;
};

/**
 * Contains state that describes the configuration of all of the plot panels
 * and the data we've sent to them.
 */
export type DatasetsState = {
  clients: Record<string, Client>;
  blocks: readonly MessageBlock[];
  current: MessageEvent[];
};

export function initDatasets(): DatasetsState {
  return {
    clients: {},
    blocks: [],
    current: [],
  };
}

/**
 * Get the SubscribePayload for a single path by subscribing to all fields
 * referenced in leading MessagePathFilters and the first field of the
 * message.
 */
export function pathToPayload(path: RosPath): SubscribePayload | undefined {
  const { messagePath: parts, topicName: topic } = path;

  // We want to take _all_ of the filters that start the path, since these can
  // be chained
  const filters = R.takeWhile((part: MessagePathPart) => part.type === "filter", parts);
  const firstField = parts.find((part: MessagePathPart) => part.type === "name");
  if (firstField == undefined || firstField.type !== "name") {
    return undefined;
  }

  return {
    topic,
    fields: R.pipe(
      R.chain((part: MessagePathPart): string[] => {
        if (part.type !== "filter") {
          return [];
        }
        const { path: filterPath } = part;
        const field = filterPath[0];
        if (field == undefined) {
          return [];
        }

        return [field];
      }),
      // Always subscribe to the header field
      (filterFields) => [...filterFields, firstField.name, "header"],
      R.uniq,
    )(filters),
  };
}

/**
 * Turn a list of ROS paths into SubscribePayloads.
 */
function getPayloadsFromPaths(paths: readonly string[]): SubscribePayload[] {
  return R.pipe(
    R.chain((path: string): SubscribePayload[] => {
      const parsed = parseRosPath(path);
      if (parsed == undefined) {
        return [];
      }

      const payload = pathToPayload(parsed);
      if (payload == undefined) {
        return [];
      }

      return [payload];
    }),
    // Then simplify
    (v: SubscribePayload[]) => mergeSubscriptions(v) as SubscribePayload[],
  )(paths);
}

/**
 * Get all of the SubscribePayloads necessary to fulfill a client's requests.
 */
export function getClientPayloads(client: Client): SubscribePayload[] {
  const { params } = client;
  if (params == undefined) {
    return [];
  }

  const { xAxisPath, paths: yAxisPaths } = params;

  return R.pipe(
    getPayloadsFromPaths,
    R.chain((v): SubscribePayload[] => {
      const partial: SubscribePayload = {
        ...v,
        preloadType: "partial",
      };

      // Subscribe to both "partial" and "full" when using "full" In
      // theory, "full" should imply "partial" but not doing this breaks
      // MockMessagePipelineProvider
      return [partial, { ...partial, preloadType: "full" }];
    }),
  )(getPaths(yAxisPaths, xAxisPath));
}

/**
 * Get the minimal, merged list of all SubscribePayloads necessary to satisfy
 * the requests for all of the clients contained in DatasetsState.
 */
export function getAllSubscriptions(state: DatasetsState): SubscribePayload[] {
  const { clients } = state;
  return R.pipe(
    R.values,
    R.chain(getClientPayloads),
    (v) => mergeSubscriptions(v) as SubscribePayload[],
  )(clients);
}

/**
 * Partition a list of SubscribePayload into full and partial subscriptions.
 */
export function splitSubscriptions(
  subscriptions: SubscribePayload[],
): [blocks: SubscribePayload[], current: SubscribePayload[]] {
  return R.partition((v) => v.preloadType === "full", subscriptions);
}

/**
 * Update the state of every client given a new set of blocks and produce a
 * BlockUpdate that can be passed to the worker.
 */
export function updateBlocks(
  blocks: readonly MessageBlock[],
  state: DatasetsState,
): [DatasetsState, BlockUpdate] {
  const { clients } = state;
  const [blockSubscriptions] = splitSubscriptions(getAllSubscriptions(state));
  const clientsAndUpdates = R.toPairs(clients).map(
    ([clientId, client]): [id: string, client: Client, updates: ClientUpdate[]] => {
      const { state: newBlocks, updates } = processBlocks(
        blocks,
        blockSubscriptions,
        client.blockState,
      );
      const newClient: Client = {
        ...client,
        blockState: newBlocks,
      };
      return [
        clientId,
        newClient,
        updates.map((update): ClientUpdate => ({ id: clientId, update })),
      ];
    },
  );

  const newClients = R.fromPairs(clientsAndUpdates.map(([clientId, client]) => [clientId, client]));

  const update = prepareBlockUpdate(
    clientsAndUpdates.flatMap(([, , updates]): ClientUpdate[] => updates),
    blocks,
  );

  return [{ ...state, blocks, clients: newClients }, update];
}

/**
 * Accumulate some current data.
 */
export function updateCurrent(
  events: readonly MessageEvent[],
  state: DatasetsState,
): DatasetsState {
  const { current: oldCurrent } = state;
  return {
    ...state,
    current: oldCurrent.concat(events),
  };
}

/**
 * Clear all existing current data.
 */
export function resetCurrent(state: DatasetsState): DatasetsState {
  return {
    ...state,
    current: [],
  };
}

/**
 * Register a new client and initialize its state.
 */
export function registerClient(id: string, state: DatasetsState): DatasetsState {
  const { clients } = state;
  return {
    ...state,
    clients: {
      ...clients,
      [id]: {
        params: undefined,
        blockState: initBlockState(),
      },
    },
  };
}

/**
 * Unregister a client.
 */
export function unregisterClient(id: string, state: DatasetsState): DatasetsState {
  const { clients } = state;
  const { [id]: _client, ...rest } = clients;

  return {
    ...state,
    clients: rest,
  };
}

/**
 * Update a client's plot settings and remove any topics from its state that
 * are no longer used.
 */
export function updateParams(id: string, params: PlotParams, state: DatasetsState): DatasetsState {
  const { clients } = state;
  const { [id]: client } = clients;
  if (client == undefined) {
    return state;
  }

  const newClient = {
    ...client,
    params,
  };

  const { blockState } = client;
  return {
    ...state,
    clients: {
      ...clients,
      [id]: {
        ...newClient,
        blockState: refreshBlockTopics(getClientPayloads(newClient), blockState),
      },
    },
  };
}

/**
 * Reset a client's BlockState and recalculate it from scratch, producing a
 * BlockUpdate for the worker.
 */
export function resetClientBlocks(id: string, state: DatasetsState): [DatasetsState, BlockUpdate] {
  const { clients, blocks } = state;

  const newClients = R.mapObjIndexed((client, clientId) => {
    if (clientId !== id) {
      return client;
    }

    return {
      ...client,
      blockState: initBlockState(),
    };
  }, clients);

  return updateBlocks(blocks, {
    ...state,
    clients: newClients,
  });
}
