// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelExtensionContext } from "@foxglove/studio";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import PanelExtensionAdapter from "@foxglove/studio-base/components/PanelExtensionAdapter";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

export default {
  title: "PanelExtensionAdapter",
  component: PanelExtensionAdapter,
};

export const CatchRenderError = (): JSX.Element => {
  const initPanel = (context: PanelExtensionContext) => {
    context.watch("topics");

    context.onRender = () => {
      const err = new Error("sample render error");
      // The default stacktrace contains paths from the webpack bundle. These paths have the bundle
      // identifier/hash and change whenever the bundle changes. This makes the story change.
      // To avoid the story changing we set the stacktrace explicitly.
      err.stack = "sample stacktrace";
      throw err;
    };
  };

  return (
    <PanelSetup
      fixture={{
        topics: [
          {
            name: "/topic",
            datatype: "test_msgs/Sample",
          },
        ],
        datatypes: new Map(),
        frame: {},
        layout: "UnknownPanel!4co6n9d",
      }}
    >
      <MockPanelContextProvider>
        <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
      </MockPanelContextProvider>
    </PanelSetup>
  );
};
