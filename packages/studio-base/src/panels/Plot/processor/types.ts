// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlotViewport } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";

import { Accumulated } from "./accumulate";
import { PlotParams, Messages, MetadataEnums } from "../internalTypes";
import { PlotData } from "../plotData";

export type Client = {
  id: string;
  params: PlotParams | undefined;
  topics: readonly string[];
  view: PlotViewport | undefined;
  blocks: Accumulated;
  current: Accumulated;
};

export type State = {
  isLive: boolean;
  clients: Client[];
  globalVariables: GlobalVariables;
  blocks: Messages;
  // all block data that was sent, but has not yet been used by a client
  pending: Messages;
  current: Messages;
  metadata: MetadataEnums;
};

export enum SideEffectType {
  Rebuild = "rebuild",
  Send = "send",
}

export type RebuildEffect = {
  type: SideEffectType.Rebuild;
  clientId: string;
};

export type DataEffect = {
  type: SideEffectType.Send;
  clientId: string;
  data: PlotData;
};

type SideEffect = RebuildEffect | DataEffect;

export type SideEffects = readonly SideEffect[];

export type StateAndEffects = [State, SideEffects];
