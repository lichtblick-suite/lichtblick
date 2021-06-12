// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelExtensionContext } from "@foxglove/studio";
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
      throw new Error("sample render error");
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
        datatypes: {},
        frame: {},
        layout: "UnknownPanel!4co6n9d",
      }}
    >
      <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
    </PanelSetup>
  );
};
