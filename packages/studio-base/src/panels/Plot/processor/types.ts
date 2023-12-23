// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlotViewport } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";

import { Accumulated } from "./accumulate";
import { Downsampled } from "./downsample";
import { BlockUpdate } from "../blocks";
import { PlotParams, MetadataEnums } from "../internalTypes";
import { PlotData } from "../plotData";

export type Client = {
  id: string;
  params: PlotParams | undefined;
  topics: readonly string[];
  view: PlotViewport | undefined;
  blocks: Accumulated;
  current: Accumulated;
  downsampled: Downsampled;
};

export type State = {
  isLive: boolean;
  clients: Client[];
  globalVariables: GlobalVariables;
  // all block data that was sent, but has not yet been used by a client
  pending: BlockUpdate[];
  metadata: MetadataEnums;
};

export enum SideEffectType {
  Rebuild = "rebuild",
  Send = "send",
  Clear = "clear",
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

export type ClearEffect = {
  type: SideEffectType.Clear;
  clientId: string;
};

type SideEffect = RebuildEffect | DataEffect | ClearEffect;

export type SideEffects = readonly SideEffect[];

export type StateAndEffects = [State, SideEffects];
