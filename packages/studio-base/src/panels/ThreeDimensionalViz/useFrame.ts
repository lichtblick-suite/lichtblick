// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback, useRef } from "react";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { Frame, MessageEvent } from "@foxglove/studio-base/players/types";

type FrameState = { reset: boolean; frame: Frame };

/**
 * useFrame returns the latest frame of messages.
 *
 * This hook is stateful. It will trigger a re-render when there are new frames.
 *
 * @returns an object with a reset field and a frame field. The reset field indicates if
 * the frame marks a new series of frames rather than a continuation of previous frames
 */
const useFrame = (topics: string[]): FrameState => {
  // useMessageReducer may invoke restore and addMessages multiple times in a single pass
  // We use this flag to indicate if we've returned the result from a previous state update
  // and can start accumulating a new state
  const returnedLastValueRef = useRef(false);

  // accumulate messages into a frame until we return the frame
  // once we've returned the frame we can accumulate messages into a new frame
  // reset indicates when the frame is the start of a new frame sequence
  const response = PanelAPI.useMessageReducer<FrameState>({
    topics,
    restore: useCallback(() => {
      returnedLastValueRef.current = false;
      return { reset: true, frame: {} };
    }, []),
    addMessages: useCallback((prev: FrameState, messages: readonly MessageEvent<unknown>[]) => {
      if (returnedLastValueRef.current) {
        // after we've returned the value we can remove the reset flag and clear the frame
        prev.reset = false;
        prev.frame = {};
        returnedLastValueRef.current = false;
      }

      for (const message of messages) {
        (prev.frame[message.topic] ??= []).push(message);
      }

      // every call to addMessages returns a new reference to trigger a state update
      return { reset: prev.reset, frame: { ...prev.frame } };
    }, []),
  });

  // indicate we've returned the previous state and can start building a new frame
  returnedLastValueRef.current = true;

  return response;
};

export default useFrame;
