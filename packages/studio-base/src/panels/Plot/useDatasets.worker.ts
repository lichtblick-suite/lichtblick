// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { Immutable } from "@foxglove/studio";
import {
  ProviderStateSetter,
  PlotViewport,
} from "@foxglove/studio-base/components/TimeBasedChart/types";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import strPack from "@foxglove/studio-base/util/strPack";

import { BlockUpdate } from "./blocks";
import { PlotParams, TypedData } from "./internalTypes";
import { isSingleMessage } from "./params";
import { PlotData, StateHandler, getProvidedData } from "./plotData";
import {
  SideEffectType,
  State,
  StateAndEffects,
  addCurrentData,
  clearCurrentData,
  findClient,
  getClientData,
  initProcessor,
  updateMetadata,
  updateVariables,
  registerClient,
  setLive,
  unregisterClient,
  updateParams,
  updateView,
  mutateClient,
  addBlockData,
} from "./processor";
import { updateDownsample } from "./processor/downsample";

type Setter = ProviderStateSetter<TypedData[]>;

type Callbacks = {
  setPanel: StateHandler | undefined;
  setProvided: Setter | undefined;
  addPartial: Setter | undefined;
  queueRebuild: () => void;
};

let state: State = initProcessor();
let callbacks: Record<string, Callbacks> = {};
let clearClient: ((id: string) => void) | undefined;

// Throttle rebuilds to only occur at most every 100ms. This is slightly
// different from the throttled/debounced functions we use elsewhere in our
// codebase in that calls during the cooldown period will schedule at most one
// more invocation rather than simply being ignored or queued.
function makeRebuilder(id: string): () => void {
  let queue = false;
  let cooldown: ReturnType<typeof setTimeout> | undefined;

  const doRebuild = () => {
    rebuild(id);
  };
  const schedule = () => {
    cooldown = setTimeout(() => {
      cooldown = undefined;
      if (queue) {
        queue = false;
        doRebuild();
        schedule();
      }
    }, 100);
  };

  return () => {
    if (cooldown == undefined) {
      doRebuild();
      schedule();
      return;
    }
    queue = true;
  };
}

function sendPlotData(clientCallbacks: Callbacks, data: PlotData) {
  clientCallbacks.setPanel?.(data);
  clientCallbacks.setProvided?.(getProvidedData(data));
}

function rebuild(id: string) {
  const client = findClient(state, id);
  const clientCallbacks = callbacks[id];
  if (client == undefined || clientCallbacks == undefined) {
    return;
  }

  const newData = getClientData(client);
  if (newData == undefined) {
    return;
  }

  const { params, blocks, current, view, downsampled } = client;
  if (params == undefined || view == undefined) {
    return;
  }

  // We do not downsample single-message plots (for now)
  if (isSingleMessage(params)) {
    return;
  }

  const newDownsampled = updateDownsample(view, blocks.data, current.data, downsampled);

  state = mutateClient(state, id, {
    ...client,
    downsampled: newDownsampled,
  });

  if (!newDownsampled.isValid) {
    return;
  }

  sendPlotData(clientCallbacks, {
    ...newData,
    ...newDownsampled.data,
  });
}

function handleEffects([newState, effects]: StateAndEffects): void {
  state = newState;

  for (const effect of effects) {
    const clientCallbacks = callbacks[effect.clientId];
    if (clientCallbacks == undefined) {
      continue;
    }

    switch (effect.type) {
      case SideEffectType.Rebuild: {
        clientCallbacks.queueRebuild();
        break;
      }
      case SideEffectType.Clear: {
        clearClient?.(effect.clientId);
        break;
      }
      case SideEffectType.Send: {
        sendPlotData(clientCallbacks, effect.data);
        break;
      }
    }
  }
}

export const service = {
  setClearClient(callback: (id: string) => void): void {
    clearClient = callback;
  },
  addBlockData(update: BlockUpdate): void {
    handleEffects(addBlockData(update, state));
  },
  addCurrentData(events: readonly MessageEvent[], clientId?: string): void {
    handleEffects(addCurrentData(events, clientId, state));
  },
  clearCurrentData(): void {
    handleEffects(clearCurrentData(state));
  },
  getFullData(id: string): PlotData | undefined {
    const client = findClient(state, id);
    if (client == undefined) {
      return;
    }

    return getClientData(client);
  },
  updateMetadata(topics: readonly Topic[], datatypes: Immutable<RosDatatypes>): void {
    state = updateMetadata(topics, strPack(datatypes), state);
  },
  updateVariables(variables: GlobalVariables): void {
    handleEffects(updateVariables(variables, state));
  },
  registerClient(
    id: string,
    setProvided: Setter,
    setPanel: StateHandler,
    addPartial: Setter,
    params: PlotParams | undefined,
  ): void {
    callbacks[id] = {
      setProvided,
      addPartial,
      setPanel,
      queueRebuild: makeRebuilder(id),
    };

    handleEffects(registerClient(id, params, state));
  },
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setLive(value: boolean): void {
    state = setLive(value, state);
  },
  unregisterClient(id: string): void {
    const { [id]: _client, ...newCallbacks } = callbacks;
    callbacks = newCallbacks;
    state = unregisterClient(id, state);
  },
  updateParams(id: string, params: PlotParams): void {
    handleEffects(updateParams(id, params, state));
  },
  updateView(id: string, view: PlotViewport): void {
    handleEffects(updateView(id, view, state));
  },
};
Comlink.expose(service);
