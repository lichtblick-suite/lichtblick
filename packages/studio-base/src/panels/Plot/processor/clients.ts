// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { fillInGlobalVariablesInPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { PlotViewport } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";

import { initAccumulated } from "./accumulate";
import { initDownsampled } from "./downsample";
import { applyBlockUpdate } from "./messages";
import {
  findClient,
  noEffects,
  mutateClient,
  mapClients,
  rebuildClient,
  clearClient,
  concatEffects,
  initClient,
} from "./state";
import { StateAndEffects, SideEffects, State, Client } from "./types";
import { BlockUpdate } from "../blocks";
import { PlotParams } from "../internalTypes";
import { getParamTopics, getParamPaths } from "../params";
import {
  PlotData,
  applyDerivativeToPlotData,
  reducePlotData,
  sortPlotDataByHeaderStamp,
} from "../plotData";

/**
 * Merge block and current data. If block data contains any portion of current
 * data, we use that instead of current data.
 */
function mergeAllData(blockData: PlotData, currentData: PlotData): PlotData {
  const { bounds: blockBounds } = blockData;
  const { bounds: currentBounds } = currentData;

  let datasets: PlotData[] = [];
  if (blockBounds.x.min <= currentBounds.x.min && blockBounds.x.max > currentBounds.x.max) {
    // ignore current data if block data covers it already
    datasets = [blockData];
  } else {
    // unbounded plots should also use current data
    datasets = [blockData, currentData];
  }

  return reducePlotData(datasets);
}

/**
 * Reset all accumulated plot data for the client and tell the main thread that
 * it should resend any message data that it has.
 */
export function resetPlotData(client: Client): [Client, SideEffects] {
  const { id, params } = client;
  if (params == undefined) {
    return noEffects(client);
  }

  return [
    {
      ...client,
      topics: getParamTopics(params),
      current: initAccumulated(),
      blocks: initAccumulated(),
    },
    [clearClient(id)],
  ];
}

export function updateVariables(variables: GlobalVariables, state: State): StateAndEffects {
  const newState = {
    ...state,
    globalVariables: variables,
  };

  return mapClients((client) => {
    const { params } = client;
    if (params == undefined) {
      return noEffects(client);
    }

    // We only want to rebuild clients whose paths actually change when global
    // variables do
    const changedPaths = R.pipe(
      R.chain((path: string) => {
        const original = parseRosPath(path);
        if (original == undefined) {
          return [];
        }

        const filled = fillInGlobalVariablesInPath(original, variables);
        return !R.equals(original.messagePath, filled.messagePath) ? [filled] : [];
      }),
    )(getParamPaths(params));

    if (changedPaths.length === 0) {
      return noEffects(client);
    }

    return resetPlotData(client);
  })(newState);
}

export function updateParams(id: string, params: PlotParams, state: State): StateAndEffects {
  return R.pipe(
    mapClients((client) => {
      const { id: clientId } = client;
      if (clientId !== id) {
        return noEffects(client);
      }

      return resetPlotData({
        ...client,
        params,
        topics: getParamTopics(params),
        downsampled: initDownsampled(),
      });
    }),
    concatEffects((newState: State): StateAndEffects => {
      const { pending } = newState;

      // When we receive params for a client, we check to see whether any of
      // the pending data we have in the queue applies to them.
      const clientIds = newState.clients.map(({ id: clientId }) => clientId);
      const allUpdates = pending.map(
        (update: BlockUpdate): [next: BlockUpdate, applied: BlockUpdate] => {
          const { updates } = update;
          const [used, unused] = R.partition(
            ({ id: clientId }) => clientIds.includes(clientId),
            updates,
          );
          return [
            { ...update, updates: unused },
            { ...update, updates: used },
          ];
        },
      );

      const newPending: BlockUpdate[] = allUpdates
        .filter(([unused]) => unused.updates.length > 0)
        .map(([unused]) => unused);

      const updatesToApply: BlockUpdate[] = allUpdates
        .filter(([, used]) => used.updates.length > 0)
        .map(([, used]) => used);

      return R.reduce(
        (a: StateAndEffects, update: BlockUpdate): StateAndEffects => {
          return concatEffects((nextState) => applyBlockUpdate(update, nextState))(a);
        },
        noEffects({
          ...newState,
          pending: newPending,
        }),
        updatesToApply,
      );
    }),
  )(state);
}

export function updateView(id: string, view: PlotViewport, state: State): StateAndEffects {
  const client = findClient(state, id);
  if (client == undefined) {
    return noEffects(state);
  }
  return [mutateClient(state, id, { ...client, view }), [rebuildClient(id)]];
}

export function registerClient(
  id: string,
  params: PlotParams | undefined,
  state: State,
): StateAndEffects {
  const { clients } = state;
  const newState = {
    ...state,
    clients: [...clients, initClient(id, params)],
  };

  if (params == undefined) {
    return [newState, []];
  }

  return updateParams(id, params, newState);
}

export function unregisterClient(id: string, state: State): State {
  return {
    ...state,
    clients: R.filter(({ id: clientId }: Client) => clientId !== id, state.clients),
  };
}

export function getClientData(client: Client): PlotData | undefined {
  const {
    params,
    view,
    blocks: { data: blockData },
    current: { data: currentData },
  } = client;

  if (params == undefined || view == undefined) {
    return undefined;
  }

  return R.pipe(
    sortPlotDataByHeaderStamp,
    applyDerivativeToPlotData,
  )(mergeAllData(blockData, currentData));
}
