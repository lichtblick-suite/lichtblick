// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toSec } from "@foxglove/rostime";
import { AppSettingValue, MessageEvent, ParameterValue, RenderState } from "@foxglove/studio";
import {
  EMPTY_GLOBAL_VARIABLES,
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerState, Topic } from "@foxglove/studio-base/players/types";
import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

const EmptyParameters = new Map<string, ParameterValue>();

type BuilderRenderStateInput = {
  watchedFields: Set<string>;
  playerState: PlayerState | undefined;
  appSettings: Map<string, AppSettingValue> | undefined;
  currentFrame: MessageEvent<unknown>[] | undefined;
  colorScheme: RenderState["colorScheme"] | undefined;
  globalVariables: GlobalVariables;
  hoverValue: HoverValue | undefined;
  sortedTopics: readonly Topic[];
  subscribedTopics: string[];
};

type BuildRenderStateFn = (input: BuilderRenderStateInput) => Readonly<RenderState> | undefined;

/**
 * initRenderStateBuilder creates a function that transforms render state input into a new
 * RenderState
 *
 * This function tracks previous input to determine what parts of the existing render state to
 * update or whether there are any updates
 *
 * @returns a function that accepts render state input and returns a new RenderState to render or
 * undefined if there's no update for rendering
 */
function initRenderStateBuilder(): BuildRenderStateFn {
  let prevVariables: GlobalVariables = EMPTY_GLOBAL_VARIABLES;
  let prevBlocks: unknown;
  let prevSeekTime: number | undefined;
  let prevSubscribedTopics: string[];
  let prevSortedTopics: readonly Topic[] | undefined;

  const prevRenderState: RenderState = {};

  return function buildRenderState(input: BuilderRenderStateInput) {
    const {
      playerState,
      watchedFields,
      appSettings,
      currentFrame,
      colorScheme,
      globalVariables,
      hoverValue,
      subscribedTopics,
      sortedTopics,
    } = input;

    // If the player has loaded all the blocks, the blocks reference won't change so our message
    // pipeline handler for allFrames won't create a new set of all frames for the newly
    // subscribed topic. To ensure a new set of allFrames with the newly subscribed topic is
    // created, we unset the blocks ref which will force re-creating allFrames.
    if (subscribedTopics !== prevSubscribedTopics) {
      prevBlocks = undefined;
    }
    prevSubscribedTopics = subscribedTopics;

    // Should render indicates whether any fields of render state are updated
    let shouldRender = false;

    const activeData = playerState?.activeData;

    // The render state starts with the previous render state and changes are applied as detected
    const renderState: RenderState = prevRenderState;

    if (watchedFields.has("didSeek")) {
      const didSeek = prevSeekTime !== activeData?.lastSeekTime;
      if (didSeek !== renderState.didSeek) {
        renderState.didSeek = didSeek;
        shouldRender = true;
      }
      prevSeekTime = activeData?.lastSeekTime;
    }

    if (watchedFields.has("currentFrame")) {
      // If there are new frames we render
      // If there are old frames we render (new frames either replace old or no new frames)
      // Note: renderState.currentFrame.length !== currentFrame.length is wrong because it
      // won't render when the number of messages is the same from old to new
      if (renderState.currentFrame?.length !== 0 || currentFrame?.length !== 0) {
        shouldRender = true;
        renderState.currentFrame = currentFrame;
      }
    }

    if (watchedFields.has("parameters")) {
      const parameters = activeData?.parameters ?? EmptyParameters;
      if (parameters !== renderState.parameters) {
        shouldRender = true;
        renderState.parameters = parameters;
      }
    }

    if (watchedFields.has("variables")) {
      if (globalVariables !== prevVariables) {
        shouldRender = true;
        prevVariables = globalVariables;
        renderState.variables = new Map(Object.entries(globalVariables));
      }
    }

    if (watchedFields.has("topics")) {
      if (sortedTopics !== prevSortedTopics) {
        shouldRender = true;
        renderState.topics = sortedTopics.map(({ name, schemaName }) => ({
          name,
          datatype: schemaName,
          schemaName,
        }));
        prevSortedTopics = sortedTopics;
      }
    }

    if (watchedFields.has("allFrames")) {
      // see comment for prevBlocksRef on why extended message store updates are gated this way
      const newBlocks = playerState?.progress.messageCache?.blocks;
      if (newBlocks && prevBlocks !== newBlocks) {
        shouldRender = true;
        const frames: MessageEvent<unknown>[] = (renderState.allFrames = []);
        for (const block of newBlocks) {
          if (!block) {
            continue;
          }

          for (const messageEvents of Object.values(block.messagesByTopic)) {
            for (const messageEvent of messageEvents) {
              if (!subscribedTopics.includes(messageEvent.topic)) {
                continue;
              }
              frames.push(messageEvent);
            }
          }
        }
      }
      prevBlocks = newBlocks;
    }

    if (watchedFields.has("currentTime")) {
      const currentTime = activeData?.currentTime;

      if (currentTime != undefined && currentTime !== renderState.currentTime) {
        shouldRender = true;
        renderState.currentTime = currentTime;
      } else {
        if (renderState.currentTime != undefined) {
          shouldRender = true;
        }
        renderState.currentTime = undefined;
      }
    }

    if (watchedFields.has("previewTime")) {
      const startTime = activeData?.startTime;

      if (startTime != undefined && hoverValue != undefined) {
        const stamp = toSec(startTime) + hoverValue.value;
        if (stamp !== renderState.previewTime) {
          shouldRender = true;
        }
        renderState.previewTime = stamp;
      } else {
        if (renderState.previewTime != undefined) {
          shouldRender = true;
        }
        renderState.previewTime = undefined;
      }
    }

    if (watchedFields.has("colorScheme")) {
      if (colorScheme !== renderState.colorScheme) {
        shouldRender = true;
        renderState.colorScheme = colorScheme;
      }
    }

    if (watchedFields.has("appSettings")) {
      if (renderState.appSettings !== appSettings) {
        shouldRender = true;
        renderState.appSettings = appSettings;
      }
    }

    if (!shouldRender) {
      return undefined;
    }

    return renderState;
  };
}

export { initRenderStateBuilder };
