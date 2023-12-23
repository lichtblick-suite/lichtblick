// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { Immutable } from "@foxglove/studio";
import { getTypedLength } from "@foxglove/studio-base/components/Chart/datasets";
import { messagePathStructures } from "@foxglove/studio-base/components/MessagePathSyntax/messagePathsForDatatype";
import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { enumValuesByDatatypeAndField } from "@foxglove/studio-base/util/enums";

import { initAccumulated, accumulate, buildPlot } from "./accumulate";
import {
  rebuildClient,
  sendData,
  mapClients,
  noEffects,
  concatEffects,
  mutateClient,
} from "./state";
import { State, StateAndEffects, Client, SideEffects } from "./types";
import { BlockUpdate, ClientUpdate } from "../blocks";
import { Messages } from "../internalTypes";
import { isSingleMessage } from "../params";

// Maximum number of accumulated current messages before triggering a cull
const ACCUMULATED_CURRENT_MESSAGE_CULL_THRESHOLD = 50_000;

export function updateMetadata(
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

/**
 * Resolve a set of ClientUpdates into the messages that they refer to.
 */
function resolveUpdates(
  messages: Record<string, (readonly MessageEvent[])[]>,
  updates: ClientUpdate[],
): Messages {
  return R.reduce(
    (a: Messages, clientUpdate: ClientUpdate): Messages => {
      const {
        update: { blockRange, topic },
      } = clientUpdate;

      const [start, end] = blockRange;
      const topicMessages = messages[topic];
      if (topicMessages == undefined) {
        return a;
      }

      return {
        ...a,
        [topic]: topicMessages.slice(start, end).flat(),
      };
    },
    {},
    updates,
  );
}

/**
 * Consolidate block data updates for each client and build new plots.
 */
export function applyBlockUpdate(update: BlockUpdate, state: State): StateAndEffects {
  const { metadata, globalVariables } = state;
  const { messages, updates: clientUpdates } = update;

  // We aggregate all of the updates for each client and then apply them as a
  // group. This is because we don't want the `shouldReset` field, which can
  // reset the plot data, to throw away data we aggregated from an update we
  // just applied.
  const updatesByClient = R.toPairs(R.groupBy(({ id }) => id, clientUpdates));

  // This reduce applies updates for each client, one at a time
  return R.reduce(
    (
      stateAndEffects: StateAndEffects,
      [clientId, updates]: [string, ClientUpdate[] | undefined],
    ): StateAndEffects => {
      return concatEffects((newState: State): StateAndEffects => {
        const client = newState.clients.find(({ id }) => id === clientId);
        if (client == undefined || updates == undefined) {
          return noEffects(newState);
        }

        const { params } = client;
        if (params == undefined || isSingleMessage(params)) {
          return noEffects(newState);
        }

        const shouldReset = updates.some(
          ({ update: { shouldReset: updateShouldReset } }) => updateShouldReset,
        );

        const newBlockData = accumulate(
          metadata,
          globalVariables,
          shouldReset ? initAccumulated() : client.blocks,
          params,
          resolveUpdates(messages, updates),
        );

        return [
          mutateClient(newState, client.id, {
            ...client,
            blocks: newBlockData,
          }),
          [rebuildClient(client.id)],
        ];
      })(stateAndEffects);
    },
    noEffects(state),
    updatesByClient,
  );
}

/**
 * Distribute new block data to all clients.
 */
export function addBlockData(update: BlockUpdate, state: State): StateAndEffects {
  const { pending } = state;
  const { updates, messages } = update;

  // If we get updates for clients that haven't registered yet, we've got to
  // keep that data around and use it when they register
  const clientIds = state.clients.map(({ id }) => id);
  const unused = updates.filter(({ id }) => !clientIds.includes(id));
  return applyBlockUpdate(update, {
    ...state,
    pending: [...pending, ...(unused.length > 0 ? [{ messages, updates: unused }] : [])],
  });
}

/**
 * Distribute new current data to all clients, or (optionally) just a single
 * client specified by `clientId`.
 */
export function addCurrentData(
  events: readonly MessageEvent[],
  clientId: string | undefined,
  state: State,
): StateAndEffects {
  const current = R.groupBy((v: MessageEvent) => v.topic, events) as Messages;

  return mapClients((client): [Client, SideEffects] => {
    const { metadata, globalVariables } = state;
    const { id, params } = client;

    if (clientId != undefined && id !== clientId) {
      return noEffects(client);
    }

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

    const accumulatedCurrent = accumulate(
      metadata,
      globalVariables,
      clientId != undefined ? initAccumulated() : client.current,
      params,
      current,
    );

    // prune the accumulation of current data so it does not grow indefinitely during live playback
    for (const dataset of accumulatedCurrent.data.datasets) {
      const typedDataSet = dataset[1];

      const typedData = typedDataSet.data;
      if (getTypedLength(typedData) <= ACCUMULATED_CURRENT_MESSAGE_CULL_THRESHOLD) {
        continue;
      }

      // We cull down to less than the threshold so we don't have to cull with every new addCurrentData call
      let remainingCapacity = ACCUMULATED_CURRENT_MESSAGE_CULL_THRESHOLD - 5_000;

      // The latest accumulated data is added to the end of the typed dataset so we loop backwards
      // reducing the remaining capacity and slicing downy the arrays to meet the remaining capacity
      //
      // The sliced arrays are added to newData
      const newData = [];
      for (let i = typedData.length - 1; i >= 0; --i) {
        if (remainingCapacity <= 0) {
          continue;
        }

        const item = typedData[i]!;
        const valuesLength = item.x.length;
        if (valuesLength > remainingCapacity) {
          const sliceIdx = valuesLength - remainingCapacity;
          item.x = item.x.slice(sliceIdx);
          item.y = item.y.slice(sliceIdx);
          item.constantName = item.constantName?.slice(sliceIdx);
          item.headerStamp = item.headerStamp?.slice(sliceIdx);
          item.receiveTime = item.receiveTime.splice(sliceIdx);
          item.value = item.value.slice(sliceIdx);
        }

        remainingCapacity -= item.x.length;
        newData.push(typedData[i]!);
      }

      // Reverse newData because we looped backwards over the typedData arrays to keep newest data
      // but the dataset needs to be oldest data first
      typedDataSet.data = newData.reverse();
    }

    return [
      {
        ...client,
        current: accumulatedCurrent,
      },
      [rebuildClient(id)],
    ];
  })(state);
}

/**
 * Clear out the current data for all clients.
 */
export function clearCurrentData(state: State): StateAndEffects {
  const newState = {
    ...state,
    current: {},
  };

  return mapClients((client) => {
    return [
      {
        ...client,
        current: initAccumulated(),
      },
      [rebuildClient(client.id)],
    ];
  })(newState);
}
