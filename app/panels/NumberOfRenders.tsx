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
import * as React from "react";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Flex from "@foxglove-studio/app/components/Flex";
import MessageHistoryDEPRECATED from "@foxglove-studio/app/components/MessageHistoryDEPRECATED";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import inScreenshotTests from "@foxglove-studio/app/stories/inScreenshotTests";

const MAX_ALLOWABLE_RENDER_COUNT = 10;

// Little dummy panel that just shows the number of renders that happen when not subscribing
// to anything. Useful for debugging performance issues.
let panelRenderCount = 0;
let messageHistoryRenderCount = 0;
let messagePipelineRenderCount = 0;
let useMessageReducerRenderCount = 0;

// Exported for stories
export const resetRenderCountsForTests = () => {
  panelRenderCount = 0;
  messageHistoryRenderCount = 0;
  messagePipelineRenderCount = 0;
  useMessageReducerRenderCount = 0;
};

(window as any).getNumberOfRendersCountsForTests = function () {
  return {
    panelRenderCount,
    messageHistoryRenderCount,
    useMessageReducerRenderCount,
    messagePipelineRenderCount,
  };
};

const getRenderCountMessage = (renderCount: number) =>
  renderCount <= MAX_ALLOWABLE_RENDER_COUNT ? "✅ Ok!" : `🆇 Too many renders = ${renderCount}`;

function HooksComponent() {
  PanelAPI.useMessageReducer({
    topics: [],
    restore: React.useCallback(() => null, []),
    addMessage: React.useCallback(() => null, []),
  });
  return <>useMessageReducerRenderCount: {getRenderCountMessage(useMessageReducerRenderCount++)}</>;
}

function MessagePipelineRendersComponent() {
  // This is a private API, so panels should not be using it, but it's still bad if it renders too
  // much. And in practice there might still be some panels that use it directly. :-(
  useMessagePipeline<MessagePipelineContext>((context: MessagePipelineContext) => context);
  return <>messagePipelineRenderCount: {++messagePipelineRenderCount}</>;
}

function NumberOfRenders(): React.ReactNode {
  panelRenderCount++;
  return (
    <Flex col>
      <PanelToolbar />
      <Flex col center style={{ fontSize: 20, lineHeight: 1.5, textAlign: "center" }}>
        <div>
          <MessageHistoryDEPRECATED paths={[]}>
            {() => (
              <>
                panelRenderCount: {getRenderCountMessage(panelRenderCount)} <br />
                messageHistoryRenderCount: {getRenderCountMessage(++messageHistoryRenderCount)}
              </>
            )}
          </MessageHistoryDEPRECATED>
        </div>
        <div>
          <HooksComponent />
        </div>
        {
          !inScreenshotTests() && <MessagePipelineRendersComponent /> // Too flakey for screenshots.
        }
      </Flex>
    </Flex>
  );
}

NumberOfRenders.panelType = "NumberOfRenders";
NumberOfRenders.defaultConfig = {};

export default Panel(NumberOfRenders as any);
