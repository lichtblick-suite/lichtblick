// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { initAccumulated } from "./accumulate";
import { initDownsampled } from "./downsample";
import {
  Client,
  RebuildEffect,
  ClearEffect,
  State,
  SideEffectType,
  DataEffect,
  SideEffects,
  StateAndEffects,
} from "./types";
import { PlotParams } from "../internalTypes";
import { getParamTopics } from "../params";
import { PlotData } from "../plotData";

export function initClient(id: string, params: PlotParams | undefined): Client {
  const topics = params != undefined ? getParamTopics(params) : [];
  return {
    id,
    params,
    topics,
    view: undefined,
    blocks: initAccumulated(),
    current: initAccumulated(),
    downsampled: initDownsampled(),
  };
}

/**
 * A side effect that triggers a rebuild, which (after a debounce) will
 * downsample and send the resulting plot dataset to the main thread.
 */
export const rebuildClient = (id: string): RebuildEffect => ({
  type: SideEffectType.Rebuild,
  clientId: id,
});

/**
 * A side effect that tells the main thread to reset this client's block data
 * (there is no per-client state for current data in the main thread) and
 * resend all relevant raw messages.
 */
export const clearClient = (id: string): ClearEffect => ({
  type: SideEffectType.Clear,
  clientId: id,
});

/**
 * A side effect that sends some plot data to the main thread for rendering
 * immediately (without downsampling.) This is only used for single-message
 * plots.
 */
export const sendData = (id: string, data: PlotData): DataEffect => ({
  type: SideEffectType.Send,
  clientId: id,
  data,
});

export function initProcessor(): State {
  return {
    isLive: false,
    clients: [],
    globalVariables: {},
    pending: [],
    metadata: {
      topics: [],
      datatypes: new Map(),
      enumValues: {},
      structures: {},
    },
  };
}

export function noEffects<T>(state: T): [T, SideEffects] {
  return [state, []];
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
export const setLive = (isLive: boolean, state: State): State => ({ ...state, isLive });

export const concatEffects =
  (mutator: (state: State) => StateAndEffects) =>
  ([state, effects]: StateAndEffects): StateAndEffects => {
    const [newState, newEffects] = mutator(state);
    return [newState, [...effects, ...newEffects]];
  };

export const findClient = (state: State, id: string): Client | undefined =>
  state.clients.find((client) => client.id === id);

/**
 * Replace the state of a client with the given ID with the provided client state.
 */
export const mutateClient = (state: State, id: string, newClient: Client): State => ({
  ...state,
  clients: state.clients.map((client) => (client.id === id ? newClient : client)),
});

export const mapClients =
  (mutator: (client: Client, state: State) => [Client, SideEffects]) =>
  (state: State): StateAndEffects => {
    const { clients } = state;
    const changes = clients.map((client): [Client, SideEffects] => mutator(client, state));
    return [
      {
        ...state,
        clients: changes.map(([v]) => v),
      },
      R.chain(([, v]) => v, changes),
    ];
  };
