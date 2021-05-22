// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { storiesOf } from "@storybook/react";
import { useMemo } from "react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import PlaybackSpeedControls from "@foxglove/studio-base/components/PlaybackSpeedControls";
import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";

const CAPABILITIES = ["setSpeed", "playbackControl"];

function ControlsStory() {
  return (
    <div
      style={{ padding: 20, paddingTop: 300 }}
      ref={(el) => {
        setImmediate(() => {
          if (el) {
            (el as any).querySelector("[data-test=PlaybackSpeedControls-Dropdown]").click();
          }
        });
      }}
    >
      <PlaybackSpeedControls />
    </div>
  );
}

storiesOf("components/PlaybackSpeedControls", module)
  .add("without speed capability", () => {
    const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
    return (
      <CurrentLayoutContext.Provider value={currentLayout}>
        <MockMessagePipelineProvider>
          <ControlsStory />
        </MockMessagePipelineProvider>
      </CurrentLayoutContext.Provider>
    );
  })
  .add("without a speed from the player", () => {
    const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
    return (
      <CurrentLayoutContext.Provider value={currentLayout}>
        <MockMessagePipelineProvider capabilities={CAPABILITIES} activeData={{ speed: undefined }}>
          <ControlsStory />
        </MockMessagePipelineProvider>
      </CurrentLayoutContext.Provider>
    );
  })
  .add("with a speed", () => {
    const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
    return (
      <CurrentLayoutContext.Provider value={currentLayout}>
        <MockMessagePipelineProvider capabilities={CAPABILITIES}>
          <ControlsStory />
        </MockMessagePipelineProvider>
      </CurrentLayoutContext.Provider>
    );
  })
  .add("with a very small speed", () => {
    const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
    return (
      <CurrentLayoutContext.Provider value={currentLayout}>
        <MockMessagePipelineProvider capabilities={CAPABILITIES} activeData={{ speed: 0.01 }}>
          <ControlsStory />
        </MockMessagePipelineProvider>
      </CurrentLayoutContext.Provider>
    );
  });
