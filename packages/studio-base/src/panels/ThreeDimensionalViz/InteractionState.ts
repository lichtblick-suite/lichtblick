// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Draft, Immutable } from "immer";
import { Dispatch } from "react";

import { MeasuringState } from "@foxglove/studio-base/panels/ThreeDimensionalViz/MeasuringTool";
import {
  PublishClickState,
  PublishClickType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/PublishClickTool";

type InteractionTool = "idle" | "measure" | "publish-click";

export type InteractionState = Immutable<{
  measure: undefined | MeasuringState;
  publish: undefined | PublishClickState;
  tool: InteractionTool;
}>;

export type InteractionStateDispatch = Dispatch<InteractionStateAction>;

type InteractionStateAction =
  | { action: "measure-update"; state: MeasuringState }
  | { action: "publish-click-update"; state: PublishClickState }
  | { action: "reset" }
  | { action: "select-tool"; tool: "idle" }
  | { action: "select-tool"; tool: "measure" }
  | { action: "select-tool"; tool: "publish-click"; type: PublishClickType };

export type InteractionStateProps<K extends keyof InteractionState> = Pick<InteractionState, K> & {
  interactionStateDispatch: InteractionStateDispatch;
};

export function makeInitialInteractionState(): InteractionState {
  return {
    measure: undefined,
    publish: undefined,
    tool: "idle",
  };
}

export function interactionStateReducer(
  draft: Draft<InteractionState>,
  action: InteractionStateAction,
): InteractionState {
  switch (action.action) {
    case "reset":
      return makeInitialInteractionState();
    case "select-tool":
      switch (action.tool) {
        case "idle":
          draft.publish = undefined;
          draft.tool = "idle";
          break;
        case "measure":
          if (draft.tool === "measure") {
            draft.tool = "idle";
          } else {
            draft.measure = { state: "start" };
            draft.tool = "measure";
          }
          break;
        case "publish-click":
          if (draft.tool === "publish-click" && draft.publish?.type === action.type) {
            draft.publish = undefined;
            draft.tool = "idle";
          } else {
            draft.publish = { state: "start", type: action.type };
            draft.tool = "publish-click";
          }
          break;
      }
      break;

    case "measure-update":
      draft.measure = action.state;
      break;

    case "publish-click-update":
      draft.publish = action.state;
  }

  return draft;
}
